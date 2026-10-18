import { render } from 'preact';
import './framework/theme/index.css';
import { CourseIndex } from './framework/layout/CourseIndex';

render(<CourseIndex />, document.getElementById('app')!);
