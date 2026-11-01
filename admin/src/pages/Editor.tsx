import { useEffect, useState } from "react";
import { Preview } from "../components/Preview";
import { Stepper } from "../components/Stepper";
import { Badge, Button, Card, Field, inputCls, Loading, Notice, PageTitle } from "../components/ui";
import { api, errorMessage, str } from "../lib/api";
import type { Row } from "../lib/api";
import { GRADES, SKILL_LABEL, SKILLS } from "../lib/consts";
import { allowed, label } from "../lib/transitions";
import { KEYS, validatePassage, validateQuestion } from "../lib/validate";
import type { PassageForm, QuestionForm } from "../lib/validate";

const emptyQ: QuestionForm = {
  external_id: "",
  grade: "6",
  skill: "ngu-phap",
  topic_id: "",
  difficulty: "1",
  passage_id: "",
  stem: "",
  options: ["", "", "", ""],
  correct_key: "",
  explanation: "",
  source_id: "",
  source_url: "",
  source_ref: "",
};
const emptyP: PassageForm = {
  external_id: "",
  source_id: "",
  title: "",
  body: "",
  word_count: "",
  level: "1",
  source_url: "",
};

const toQ = (r: Row): QuestionForm => ({
  external_id: str(r, "external_id"),
  grade: str(r, "grade"),
  skill: str(r, "skill"),
  topic_id: str(r, "topic_id"),
  difficulty: str(r, "difficulty"),
  passage_id: str(r, "passage_id"),
  stem: str(r, "stem"),
  options: KEYS.map((k) => str((r["options"] as Row[]).find((o) => o["key"] === k) ?? {}, "text")),
  correct_key: str(r, "correct_key"),
  explanation: str(r, "explanation"),
  source_id: str(r, "source_id"),
  source_url: str(r, "source_url"),
  source_ref: str(r, "source_ref"),
});
const toP = (r: Row): PassageForm => ({
  external_id: str(r, "external_id"),
  source_id: str(r, "source_id"),
  title: str(r, "title"),
  body: str(r, "body"),
  word_count: str(r, "word_count"),
  level: str(r, "level"),
  source_url: str(r, "source_url"),
});

export function Editor({ kind, id }: { kind: "questions" | "passages"; id: string }) {
  const isNew = id === "new";
  const isQ = kind === "questions";
  const [row, setRow] = useState<Row | null>(null);
  const [q, setQ] = useState<QuestionForm>(emptyQ);
  const [p, setP] = useState<PassageForm>(emptyP);
  const [sources, setSources] = useState<Row[]>([]);
  const [revisions, setRevisions] = useState<Row[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async (): Promise<void> => {
    try {
      const r = await api("GET", `/${kind}/${id}`);
      setRow(r);
      if (isQ) setQ(toQ(r));
      else setP(toP(r));
      if (isQ)
        setRevisions((await api<{ items: Row[] }>("GET", `/questions/${id}/revisions`)).items);
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void api<{ items: Row[] }>("GET", "/sources?limit=100")
      .then((s) => {
        setSources(s.items);
      })
      .catch(() => undefined);
    if (!isNew) void load();
  }, [kind, id]);

  const errors = isQ ? validateQuestion(q) : validatePassage(p);
  const shown = (k: string): string | undefined => (touched ? errors[k] : undefined);

  const payload = (): Row =>
    isQ
      ? {
          external_id: q.external_id,
          grade: Number(q.grade),
          skill: q.skill,
          topic_id: q.topic_id,
          difficulty: Number(q.difficulty),
          passage_id: q.passage_id || null,
          stem: q.stem,
          options: KEYS.map((k, i) => ({ key: k, text: q.options[i] ?? "" })),
          correct_key: q.correct_key,
          explanation: q.explanation,
          source_id: q.source_id,
          source_url: q.source_url,
          source_ref: q.source_ref || null,
        }
      : {
          external_id: p.external_id,
          source_id: p.source_id,
          title: p.title,
          body: p.body,
          word_count: Number(p.word_count),
          level: Number(p.level),
          source_url: p.source_url || null,
        };

  const save = async (): Promise<void> => {
    setTouched(true);
    if (Object.keys(errors).length) {
      setMsg({ ok: false, text: "Còn trường chưa hợp lệ." });
      return;
    }
    try {
      if (isNew) {
        const created = await api("POST", `/${kind}`, payload());
        window.location.hash = `/${kind}/${str(created, "id")}`;
      } else {
        const r = await api("PATCH", `/${kind}/${id}`, payload(), {
          "if-match": str(row ?? {}, "version"),
        });
        setRow(r);
        setMsg({ ok: true, text: "Đã lưu." });
        if (isQ)
          setRevisions((await api<{ items: Row[] }>("GET", `/questions/${id}/revisions`)).items);
      }
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  };
  const go = async (to: string): Promise<void> => {
    try {
      await api("POST", `/${kind}/${id}/transition`, { to });
      setMsg({ ok: true, text: `Đã chuyển sang "${label(to)}".` });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  };

  if (loading) return <Loading />;
  const status = str(row ?? {}, "review_status");
  const text = (
    key: string,
    form: "q" | "p",
    label_: string,
    extra?: { area?: boolean; hint?: string },
  ) => (
    <Field label={label_} error={shown(key)} {...(extra?.hint ? { hint: extra.hint } : {})}>
      {(fid, d) => {
        const value = ((form === "q" ? q : p) as unknown as Record<string, string>)[key] ?? "";
        const set = (v: string): void => {
          if (form === "q") setQ({ ...q, [key]: v });
          else setP({ ...p, [key]: v });
        };
        return extra?.area ? (
          <textarea
            id={fid}
            aria-describedby={d}
            aria-invalid={!!shown(key)}
            rows={6}
            value={value}
            onChange={(e) => {
              set(e.target.value);
            }}
            className={inputCls}
          />
        ) : (
          <input
            id={fid}
            aria-describedby={d}
            aria-invalid={!!shown(key)}
            value={value}
            onChange={(e) => {
              set(e.target.value);
            }}
            className={inputCls}
          />
        );
      }}
    </Field>
  );
  const sourceSelect = (value: string, set: (v: string) => void) => (
    <Field label="Nguồn" error={shown("source_id")}>
      {(fid, d) => (
        <select
          id={fid}
          aria-describedby={d}
          value={value}
          onChange={(e) => {
            set(e.target.value);
          }}
          className={inputCls}
        >
          <option value="">Chọn nguồn…</option>
          {sources.map((s) => (
            <option key={str(s, "id")} value={str(s, "id")}>
              {str(s, "name")}
            </option>
          ))}
        </select>
      )}
    </Field>
  );

  return (
    <>
      <PageTitle>
        {isNew ? (isQ ? "Câu hỏi mới" : "Bài đọc mới") : `${isQ ? "Câu hỏi" : "Bài đọc"} #${id}`}
      </PageTitle>
      <p className="mb-3">
        <a href="#/review">← Hàng đợi duyệt</a>
      </p>
      <div aria-live="polite">
        {msg && <Notice kind={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
      </div>
      {!isNew && (
        <>
          <Stepper status={status} />
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge status={status} />
            {allowed(isQ ? "question" : "passage", status).map((to) => (
              <Button
                key={to}
                variant={to === "published" ? "primary" : "outline"}
                onClick={() => void go(to)}
              >
                → {label(to)}
              </Button>
            ))}
          </div>
        </>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex flex-col gap-3"
        >
          {isQ ? (
            <>
              {text("external_id", "q", "Mã ngoài (external_id)")}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lớp">
                  {(fid) => (
                    <select
                      id={fid}
                      value={q.grade}
                      onChange={(e) => {
                        setQ({ ...q, grade: e.target.value });
                      }}
                      className={inputCls}
                    >
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          Lớp {g}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Kỹ năng">
                  {(fid) => (
                    <select
                      id={fid}
                      value={q.skill}
                      onChange={(e) => {
                        setQ({ ...q, skill: e.target.value });
                      }}
                      className={inputCls}
                    >
                      {SKILLS.map((s) => (
                        <option key={s} value={s}>
                          {SKILL_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                {text("topic_id", "q", "Mã chủ đề")}
                {text("difficulty", "q", "Độ khó (1–3)")}
              </div>
              {text("passage_id", "q", "Mã bài đọc (nếu có)")}
              {text("stem", "q", "Đề bài", { area: true })}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-bold">Đáp án</legend>
                {KEYS.map((k, i) => (
                  <div key={k} className="flex items-center gap-2">
                    <label className="flex min-h-11 items-center gap-1 font-bold">
                      <input
                        type="radio"
                        name="correct"
                        className="size-5"
                        checked={q.correct_key === k}
                        onChange={() => {
                          setQ({ ...q, correct_key: k });
                        }}
                        aria-label={`Đáp án ${k} là đúng`}
                      />{" "}
                      {k}
                    </label>
                    <input
                      aria-label={`Nội dung đáp án ${k}`}
                      value={q.options[i]}
                      onChange={(e) => {
                        setQ({
                          ...q,
                          options: q.options.map((o, j) => (j === i ? e.target.value : o)),
                        });
                      }}
                      className={inputCls}
                    />
                  </div>
                ))}
                {(shown("options") ?? shown("correct_key")) && (
                  <p role="alert" className="text-sm text-danger">
                    {shown("options") ?? shown("correct_key")}
                  </p>
                )}
              </fieldset>
              {text("explanation", "q", "Giải thích", { area: true })}
              {sourceSelect(q.source_id, (v) => {
                setQ({ ...q, source_id: v });
              })}
              {text("source_url", "q", "URL nguồn")}
              {text("source_ref", "q", "Tham chiếu nguồn (tuỳ chọn)")}
            </>
          ) : (
            <>
              {text("external_id", "p", "Mã ngoài (external_id)")}
              {text("title", "p", "Tiêu đề")}
              {text("body", "p", "Nội dung", { area: true })}
              <div className="grid grid-cols-2 gap-3">
                {text("word_count", "p", "Số từ", {
                  hint: `Gợi ý: ${String(p.body.trim() ? p.body.trim().split(/\s+/).length : 0)} từ`,
                })}
                {text("level", "p", "Mức (1–5)")}
              </div>
              {sourceSelect(p.source_id, (v) => {
                setP({ ...p, source_id: v });
              })}
              {text("source_url", "p", "URL nguồn (tuỳ chọn)")}
            </>
          )}
          <Button type="submit" variant="primary">
            Lưu
          </Button>
        </form>
        <div className="flex flex-col gap-4">
          {isQ ? (
            <Preview
              stem={q.stem}
              options={q.options}
              correct={q.correct_key}
              explanation={q.explanation}
            />
          ) : (
            <Card>
              <h2 className="mb-2 text-lg font-bold">Xem trước</h2>
              <h3 className="font-bold">{p.title}</h3>
              <p className="whitespace-pre-wrap text-sm">{p.body}</p>
            </Card>
          )}
          {isQ && !isNew && (
            <Card>
              <h2 className="mb-2 text-lg font-bold">Lịch sử bản sửa</h2>
              {revisions.length === 0 ? (
                <p className="text-sm text-ink-soft">Chưa có bản sửa.</p>
              ) : (
                revisions.map((r) => (
                  <details key={str(r, "id")} className="mb-1 rounded border border-line p-2">
                    <summary className="min-h-11 cursor-pointer py-2">
                      Phiên bản {str(r, "version")} · {str(r, "created_at")}
                    </summary>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                      {JSON.stringify(r["snapshot"], null, 2)}
                    </pre>
                  </details>
                ))
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
