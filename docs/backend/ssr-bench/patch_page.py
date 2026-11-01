import re, sys
p = sys.argv[1]
s = open(p).read()
s = s.replace('import { getAllTestSlugs, getTestWithQuestions, getTopics, getTestsForTopic } from "@/lib/content/load";',
              'import { getTopics } from "@/lib/content/load";\nimport { getTestSsr } from "@/lib/db-proto";')
s = s.replace('export const dynamicParams = false;\nexport const revalidate = 3600;\n', 'export const dynamic = "force-dynamic";\n')
s = re.sub(r'export function generateStaticParams\(\).*\n', '', s)
s = s.replace('const test = getTestWithQuestions(testPath(grade, skill, topic.slug, p.test).slice(1)); if (!test) return {};',
              'const test = await getTestSsr(testPath(grade, skill, topic.slug, p.test).slice(1)); if (!test) return {};')
s = s.replace('const test = getTestWithQuestions(testPath(grade,skill,topic.slug,p.test).slice(1)); if (!test) notFound();',
              'const test = await getTestSsr(testPath(grade,skill,topic.slug,p.test).slice(1)); if (!test) notFound();')
s = s.replace('const quiz = toQuizPool(test);', 'const quiz = toQuizPool(test as never);')
# siblings: replace the getTestsForTopic usage
s = s.replace('getTestsForTopic(grade,skill,topic.slug)', '(test.siblings as {slug:string;title:string}[])')
s = s.replace('datePublished: test.publishedAt', 'datePublished: test.publishedAt')
open(p, 'w').write(s)
print('patched', 'getTestSsr' in s, 'getTestsForTopic' in s, 'getTestWithQuestions' in s)
