import { useCallback, useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { Loading } from "./components/ui";
import { api, setCsrf, setOnUnauthorized } from "./lib/api";
import type { Me } from "./lib/api";
import { useRoute } from "./lib/route";
import { Audit } from "./pages/Audit";
import { Crawl } from "./pages/Crawl";
import { Dashboard } from "./pages/Dashboard";
import { Editor } from "./pages/Editor";
import { Login } from "./pages/Login";
import { Presets } from "./pages/Presets";
import { Reports } from "./pages/Reports";
import { Review } from "./pages/Review";
import { Settings } from "./pages/Settings";
import { Sources } from "./pages/Sources";
import { Tests } from "./pages/Tests";

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const refresh = useCallback(async () => {
    try {
      const r = await api<Me & { csrfToken: string }>("GET", "/auth/me");
      setCsrf(r.csrfToken);
      setMe({ email: r.email, totpEnabled: r.totpEnabled });
    } catch {
      setMe(null);
    }
  }, []);
  useEffect(() => {
    setOnUnauthorized(() => {
      setMe(null);
    });
    void refresh();
  }, [refresh]);
  const route = useRoute();

  if (me === undefined) return <Loading />;
  if (me === null) return <Login onDone={refresh} />;
  const [page = "", id] = route;
  return (
    <Layout
      me={me}
      page={page}
      onLogout={() => {
        setMe(null);
      }}
    >
      {page === "" && <Dashboard />}
      {page === "review" && <Review />}
      {(page === "questions" || page === "passages") && <Editor kind={page} id={id ?? "new"} />}
      {page === "sources" && <Sources />}
      {page === "crawl" && <Crawl />}
      {page === "tests" && <Tests />}
      {page === "presets" && <Presets />}
      {page === "reports" && <Reports />}
      {page === "audit" && <Audit />}
      {page === "settings" && <Settings me={me} onChange={refresh} />}
      {![
        "",
        "review",
        "questions",
        "passages",
        "sources",
        "crawl",
        "tests",
        "presets",
        "reports",
        "audit",
        "settings",
      ].includes(page) && (
        <p>
          Không có trang này. <a href="#/">Về trang chính</a>
        </p>
      )}
    </Layout>
  );
}
