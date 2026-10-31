import { expect, it } from "vitest";
import { classifyQuestion, type ClassifyInput } from "../lib/topics/classify";
const input = (stem: string, options: string[], explanation = "", skill: ClassifyInput["skill"] = "ngu-phap"): ClassifyInput => ({ skill, stem, options: options.map((text, i) => ({ text, key: (["A","B","C","D"] as const)[i] })), correctKey: "A", explanation, topicSlug: "so-sanh" });
const cases: [string, string[], string, string | null][] = [
 ["This is ___ bag.", ["her","his","our","their"], "", "tinh-tu-so-huu"],
 ["I like ___ new pen.", ["my","me","I","mine"], "Cần tính từ sở hữu", "tinh-tu-so-huu"],
 ["We depend ___ rain.", ["on","at","in","for"], "", "gioi-tu"],
 ["We agree ___ her.", ["with","quickly","tall","run"], "Cụm này dùng giới từ", "gioi-tu"],
 ["She has ___ umbrella.", ["an","a","the","no article"], "", "mao-tu"],
 ["My kite is ___ than yours.", ["higher","high","highly","height"], "", "so-sanh"],
 ["This is the ___ route.", ["best","good","well","better"], "", "so-sanh"],
 ["He is as ___ as Lan.", ["tall","short","small","young"], "", "so-sanh"],
 ["The new tower looks ___.", ["taller","smaller","shorter","higher"], "", "so-sanh"],
 ["She reads a ___ every week.", ["reader","book","paper","letter"], "", null],
 ["It looks ___ today.", ["more beautiful","beautiful","beauty","beautifully"], "", "so-sanh"],
 ["If it rains, I ___ stay home.", ["will","would","can","might"], "", "cau-dieu-kien"],
 ["Unless we ___ now, we will be late.", ["leave","left","leaving","leaves"], "", "cau-dieu-kien"],
 ["If I ___ rich, I would help.", ["were","am","is","be"], "", "cau-dieu-kien"],
 ["___ you live here?", ["Do","Did","Does","Are"], "", "cau-hoi"],
 ["Where ___ you live?", ["do","did","does","are"], "", "cau-hoi"],
 ["Do you ___ tea?", ["like","likes","liked","liking"], "Sau “do”, dạng nguyên thể", "cau-hoi"],
 ["The bike was ___ yesterday.", ["fixed","fix","fixes","fixing"], "Sau “was”, dùng phân từ quá khứ", "cau-bi-dong"],
 ["It has been ___ twice.", ["painted","paint","paints","painting"], "Sau “been”, phân từ quá khứ", "cau-bi-dong"],
 ["We have ___ lunch.", ["eaten","eat","eats","eating"], "Sau “have”, phân từ quá khứ", "thi-hien-tai-hoan-thanh"],
 ["She ___ arrived.", ["has","have","had","having"], "Chủ ngữ dùng has trong hiện tại hoàn thành", "thi-hien-tai-hoan-thanh"],
 ["He had ___ before noon.", ["left","leave","leaves","leaving"], "Sau “had”, phân từ quá khứ", "thi-qua-khu-hoan-thanh"],
 ["We are ___ now.", ["reading","read","reads","reader"], "Sau “are”, V-ing", "thi-hien-tai-tiep-dien"],
 ["She was ___ at six.", ["singing","sing","sings","sang"], "Sau “was”, V-ing", "thi-qua-khu-tiep-dien"],
 ["I will ___ tomorrow.", ["visit","visits","visited","visiting"], "Sau “will”, nguyên thể", "thi-tuong-lai-don"],
 ...["can","could","may","might","must","should","would","shall"].map(w => [`I ${w} ___ here.`, ["stay","stays","stayed","staying"], `Sau “${w}”, nguyên thể`, "dong-tu-khuyet-thieu"] as [string,string[],string,string]),
 ["I ought ___ here.", ["to stay","staying","stays","stayed"], "Sau “ought”, dùng to và động từ nguyên mẫu", "dong-tu-khuyet-thieu"],
 ["I want to ___ a boat.", ["buy","buys","bought","buying"], "Sau “to”, nguyên thể", "dong-tu-nguyen-mau-co-to"],
 ["I hope to ___ letters.", ["write","wrote","written","writing"], "", "dong-tu-nguyen-mau-co-to"],
 ["If you want to ___ more time, start early.", ["have","has","had","having"], "Sau “to”, dạng nguyên thể", "dong-tu-nguyen-mau-co-to"],
 ["She ___ kind.", ["is","am","are","be"], "Chủ ngữ “She” đi với “is” ở hiện tại.", "dong-tu-to-be"],
 ["They do ___ quietly.", ["work","works","worked","working"], "Sau “do”, dạng nguyên thể", "thi-hien-tai-don"],
 ["She does ___ well.", ["dance","dances","danced","dancing"], "Sau “does”, dạng nguyên thể", "thi-hien-tai-don"],
 ["We did ___ yesterday.", ["swim","swims","swam","swimming"], "Sau “did”, dạng nguyên thể", "thi-qua-khu-don"],
 ["We ___ yesterday.", ["walked","walk","walks","walking"], "", "thi-qua-khu-don"],
 ["I ___ there in 2015.", ["went","go","goes","going"], "", "thi-qua-khu-don"],
 ["Every morning she ___.", ["runs","run","ran","running"], "", "thi-hien-tai-don"],
 ["Usually the boy ___ here.", ["plays","play","played","playing"], "", "thi-hien-tai-don"],
 ["We saw a ___ pattern.", ["flower","paper","water","winter"], "", null],
 ["If you want to ___, join us.", ["dance","dances","danced","dancing"], "Sau “to”, nguyên thể", "dong-tu-nguyen-mau-co-to"],
 ["Could the team visit ___ tomorrow?", ["us","we","our","ours"], "", null],
 ["The ___ is red.", ["flower","paper","water","winter"], "", null],
];
it.each(cases)("classifies %s", (stem, opts, explanation, topic) => {
 const q = input(stem, opts, explanation); expect(classifyQuestion(q).topic).toBe(topic);
 expect(classifyQuestion({ ...q, topicSlug: "unreliable" })).toEqual(classifyQuestion(q));
 expect(classifyQuestion(structuredClone(q))).toEqual(classifyQuestion(q));
});
const vocab: [string, string, string][] = [
 ["gia-dinh-ban-be", "My sister and my ___ visit our grandmother.", "cousin"],
 ["truong-hoc", "Our teacher collects the ___ after class.", "homework"],
 ["am-thuc", "We bake bread in the ___ for dinner.", "oven"],
 ["du-lich", "The tourist booked a ___ near the airport.", "hotel"],
 ["moi-truong", "The forest and the river need ___ in summer.", "rain"],
 ["suc-khoe", "The doctor treats a ___ at the hospital.", "patient"],
 ["khoa-hoc-cong-nghe", "Connect your computer to the ___.", "internet"],
 ["cong-viec", "The company pays each ___ a salary.", "employee"],
 ["dong-vat", "The zoo feeds each ___ every morning.", "tiger"],
];
it.each(vocab)("recognizes vocabulary %s", (topic, stem, correct) => {
 expect(classifyQuestion(input(stem, [correct, "thing", "very", "seem"], "", "tu-vung")).topic).toBe(topic);
});
const vocabInput = (stem: string, correct: string, distractors: string[]) => input(stem, [correct, ...distractors], "", "tu-vung");
// Regression: items the tester/reviewer found misclassified because distractors or generic words were counted.
const rejected: [string, string, string[]][] = [
 ["Farmers became dependent on this bee ___.", "activity", ["ability", "location", "ship"]],
 ["Second, it is important to ___ a location that is safe.", "find", ["study", "known", "knew"]],
 ["Do you ___ to spend time at the coast?", "like", ["use", "make", "had"]],
 ["Her husband ___ her jewelry for her birthday.", "gave", ["reach", "include", "keep"]],
 ["She ___ the rights to Heath’s skin care products and started her own company.", "bought", ["continue", "flew", "taught"]],
 ["It ___ in June of that year.", "arrived", ["jumped", "changed", "continued"]],
 ["People from all over the country ___ to eat, drink and dance.", "come", ["remember", "increase", "continue"]],
 ["Galvão says not every student will ___ through a word map.", "learn", ["report", "mean", "close"]],
 ["A French company ___ to begin making the Wright brothers' flying machine.", "agreed", ["visited", "considered", "tuned"]],
 ["The new rule ___ to all employees in the company.", "extends", ["provides", "sailors", "messages"]],
 ["Top ___ made from bird feathers can stand a meter tall.", "hats", ["powers", "sentences", "lives"]],
 ["This ___ is for a family of teachers and students.", "place", ["school", "teacher", "hospital"]],
];
it.each(rejected)("does not classify generic or distractor-driven item: %s", (stem, correct, distractors) => {
 expect(classifyQuestion(vocabInput(stem, correct, distractors)).topic).toBeNull();
});
it("never counts distractor options as evidence", () => {
 expect(classifyQuestion(vocabInput("The ___ is here.", "thing", ["teacher", "student", "classroom"])).topic).toBeNull();
 expect(classifyQuestion(vocabInput("We ___ here.", "seem", ["oven", "bread", "rice"])).topic).toBeNull();
});
it("matches whole words only", () => {
 expect(classifyQuestion(vocabInput("The ant is on the hotelier's coat.", "tiger", ["thing", "very", "seem"])).topic).toBe("dong-vat");
 expect(classifyQuestion(vocabInput("A planetary mood about hospitality.", "hotelier", ["thing", "very", "seem"])).topic).toBeNull();
});
it("requires the correct answer to be a topic keyword", () => {
 expect(classifyQuestion(vocabInput("The doctor gave the patient some good ___.", "advice", ["thing", "very", "seem"])).topic).toBeNull();
 expect(classifyQuestion(vocabInput("The doctor gave the patient some ___.", "medicine", ["thing", "very", "seem"])).topic).toBe("suc-khoe");
});
it("one keyword needs a passage category cue and never decides from the passage alone", () => {
 const bees = { title: "Bees and pollinators", body: "The bee has wings; honeybees visit flowers. Butterflies, birds and animals also carry pollen to plants." };
 expect(classifyQuestion(vocabInput("Life is not easy for ___.", "bees", ["ideas", "meters", "express"])).topic).toBeNull();
 expect(classifyQuestion(vocabInput("Life is not easy for ___.", "bees", ["ideas", "meters", "express"]), bees).topic).toBe("dong-vat");
 expect(classifyQuestion(vocabInput("The ___ is here.", "thing", ["very", "seem", "also"]), bees).topic).toBeNull();
});
it("rejects non-target skills and word families", () => {
 const q = input("The ___ is here.", ["thing", "seem", "very", "also"], "", "tu-vung");
 expect(classifyQuestion({ ...q, explanation: "Vị trí trong câu cần trạng từ trong họ từ này." }).topic).toBeNull();
 for (const skill of ["doc-hieu", "viet-cau"] as const) expect(classifyQuestion({ ...q, skill }).topic).toBeNull();
});
it("counts overlapping word-family roots as one piece of evidence", () => {
 expect(classifyQuestion(vocabInput("The teaching ___ is here.", "teacher", ["thing", "very", "seem"])).topic).toBeNull();
});
