import { useEffect, useState } from 'preact/hooks';
import { graphConceptHref } from './learning-resources';
import { compareCourseStudyOrder, courseStudyRank } from './course-study-order';
import './quant-learning.css';

type Resource = { title: string; filename: string; pages: number; bytes: number; category: string; url: string };
type Topic = { title: string; nodeId: string; page: number; resourceUrl: string; sources?: Array<{ page: number; resourceUrl: string }> };
type Course = {
  slug: string; id: string; short: string; title: { en: string; zh: string }; university: string; year: string;
  officialUrl: string; pdfCount: number; materialBytes: number; packageKind: string;
  archive: null | { url: string; filename: string; bytes: number };
  videos: Array<{ title: string; url: string }>; resources: Resource[]; topics: Topic[]; hubNode: string;
};
export function openCourseAsset(path: string): string {
  return new URL(`${import.meta.env.DEV ? '/' : './'}open-courses/${path}`, window.location.href).href;
}
const categoryNames: Record<string, string> = {
  '讲义与课件': 'Lecture notes and slides', '习题与考试': 'Assignments and exams',
  '答案': 'Solutions', '视频文字稿': 'Video transcripts', '其他材料': 'Other materials',
};
function CourseCard({ course, lang, query, category }: { course: Course; lang: 'en' | 'zh'; query: string; category: string }) {
  const chinese = lang === 'zh';
  const [limit, setLimit] = useState(30);
  useEffect(() => setLimit(30), [query, category]);
  const resources = course.resources.filter((resource) => (!category || resource.category === category)
    && (!query || `${resource.title} ${resource.filename}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  return <section class="open-course-card" id={`course-${course.id.replaceAll('.', '-')}`}>
    <h3>{courseStudyRank(course.id)}. {course.university} {course.id.replace('MIT-', '')} · {course.title[lang]}</h3>
    <p class="quant-reader__note">{course.year} · {course.pdfCount} PDF · {(course.materialBytes / 1024 / 1024).toFixed(1)} MB
      {course.packageKind === 'public-notes' ? (chinese ? ' · 公开讲义合集，含章末习题' : ' · Public notes with chapter exercises')
        : course.packageKind === 'github-mirror' ? (chinese ? ' · 学生维护的 GitHub 镜像：讲义与教材，作业 notebook 在 GitHub 上' : ' · Student-maintained GitHub mirror: lecture slides and textbook; assignment notebooks stay on GitHub')
        : (chinese ? ' · 官方完整静态课程包' : ' · Complete official static course package')}</p>
    <div class="quant-roadmap__links">
      <a href={graphConceptHref(course.hubNode)}>{chinese ? '在星图中探索课程' : 'Explore course in the graph'}</a>
      <a href={course.officialUrl} target="_blank" rel="noopener noreferrer">{course.packageKind === 'github-mirror' ? (chinese ? 'GitHub 镜像（非官方）' : 'GitHub mirror (unofficial)') : chinese ? '大学官方课程页' : 'Official course page'} ↗</a>
      {course.archive && <a href={openCourseAsset(course.archive.url)} download={course.archive.filename}>
        {chinese ? '下载原始整包 ZIP' : 'Download original ZIP'} ({(course.archive.bytes / 1024 / 1024).toFixed(1)} MB)</a>}
    </div>
    <details><summary>{chinese ? '课程专题与源文件定位' : 'Topics and source locations'} ({course.topics.length})</summary>
      <ul class="open-course-topics">{course.topics.map((topic, index) => <li key={`${topic.nodeId}-${index}`}>
        <a href={graphConceptHref(topic.nodeId)}>{topic.title}</a>{' · '}
        {(topic.sources ?? [{ page: topic.page, resourceUrl: topic.resourceUrl }]).map((source, sourceIndex) => <span key={source.resourceUrl}>
          {sourceIndex > 0 && ' · '}<a href={openCourseAsset(source.resourceUrl)} target="_blank" rel="noopener noreferrer">PDF {sourceIndex + 1} · p {source.page}</a>
        </span>)}
      </li>)}</ul>
    </details>
    <details open={!!query || !!category}><summary>{chinese ? '全部 PDF 材料' : 'All PDF materials'} ({resources.length} / {course.pdfCount})</summary>
      <ul class="open-course-files">{resources.slice(0, limit).map((resource) => <li key={resource.url}>
        <a href={openCourseAsset(resource.url)} target="_blank" rel="noopener noreferrer">{resource.title}</a>
        <span class="quant-reader__note"> · {chinese ? resource.category : categoryNames[resource.category]} · {resource.pages} {chinese ? '页' : 'pages'}</span>
      </li>)}</ul>
      {!resources.length && <p>{chinese ? '当前筛选没有匹配材料。' : 'No materials match these filters.'}</p>}
      {resources.length > limit && <button class="btn btn--ghost" type="button" onClick={() => setLimit((value) => value + 60)}>
        {chinese ? `显示更多（还有 ${resources.length - limit} 项）` : `Show more (${resources.length - limit} remaining)`}</button>}
    </details>
    {!!course.videos.length && <details><summary>{chinese ? '官方视频入口（视频未下载）' : 'Official video links (videos not downloaded)'} ({course.videos.length})</summary>
      <ul class="open-course-files">{course.videos.map((video) => <li key={video.url}>
        <a href={video.url} target="_blank" rel="noopener noreferrer">{video.title} ↗</a>
      </li>)}</ul>
    </details>}
  </section>;
}
export function OpenCourseLibrary({ lang }: { lang: 'en' | 'zh' }) {
  const chinese = lang === 'zh';
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(openCourseAsset('catalog.json'), { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(`Materials index: ${response.status}`);
      const value = await response.json();
      if (value.version !== 1 || !Array.isArray(value.courses)) throw new Error('Invalid materials index.');
      if (!controller.signal.aborted) setCourses([...value.courses].sort(compareCourseStudyOrder));
    }).catch((reason) => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!courses.length || !window.location.hash.startsWith('#course-')) return;
    const frame = requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [courses]);
  if (error) return <p role="alert">{chinese ? '公开课材料索引读取失败：' : 'Could not load course materials: '}{error}</p>;
  if (!courses.length) return <p role="status">{chinese ? '正在读取本地公开课材料…' : 'Loading local course materials…'}</p>;
  return <div class="open-course-library">
    <p>{courses.length} {chinese ? '门课程' : 'courses'} · {courses.reduce((sum, course) => sum + course.pdfCount, 0)} PDF
      {chinese ? '（同一课程内按文件内容去重）' : ' (deduplicated by content within each course)'}</p>
    <p class="quant-reader__note">{chinese ? '按星图建议学习顺序排列，编号与星图一致。基础较好时，前两门先做习题查漏；测度概率适合随机分析方向的深入学习。' : 'Ordered by the graph study route, using the same step numbers. If your foundations are strong, review the first two courses through problems; measure-theoretic probability supports deeper stochastic analysis.'}</p>
    <nav class="quant-roadmap__links" aria-label={chinese ? '公开课快捷入口' : 'Course shortcuts'}>
      {courses.map((course) => <a key={course.id} href={`#course-${course.id.replaceAll('.', '-')}`}>{courseStudyRank(course.id)}. {course.short} · {course.title[lang]}</a>)}
    </nav>
    <div class="open-course-filters">
      <label>{chinese ? '搜索材料' : 'Search materials'}<input type="search" value={query}
        onInput={(event) => setQuery(event.currentTarget.value)} placeholder={chinese ? '主题或文件名…' : 'Topic or filename…'} /></label>
      <label>{chinese ? '材料类型' : 'Material type'}<select value={category} onChange={(event) => setCategory(event.currentTarget.value)}>
        <option value="">{chinese ? '全部类型' : 'All types'}</option>
        {Object.entries(categoryNames).map(([zh, en]) => <option value={zh} key={zh}>{chinese ? zh : en}</option>)}
      </select></label>
    </div>
    {courses.map((course) => <CourseCard key={course.id} course={course} lang={lang} query={query} category={category} />)}
  </div>;
}
