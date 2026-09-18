import { render } from 'preact';
import '../../../framework/theme/index.css';
import { Lesson } from '../../../framework/layout/Lesson';
import type { LessonMeta } from '../../../framework/layout/LessonContext';
import En from './lesson.en.mdx';
import Fi from './lesson.fi.mdx';
import meta from './meta.json';
import terms from './terms.json';

render(<Lesson meta={meta as LessonMeta} En={En} Fi={Fi} terms={terms} />, document.getElementById('app')!);
