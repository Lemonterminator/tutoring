import { render } from 'preact';
import '../../../framework/theme/index.css';
import { CourseLesson, type CourseLessonMeta } from '../../../framework/layout/CourseLesson';
import En from './lesson.en.mdx';
import Zh from './lesson.zh.mdx';
import meta from './meta.json';
render(<CourseLesson meta={meta as CourseLessonMeta} En={En} Zh={Zh} />, document.getElementById('app')!);
