import { Figure } from './ask/Figure';
import { Beyond, ExamTip, Syllabus } from './blocks/Blocks';
import { Term } from './i18n/Term';
import { Choice, ChoiceQuiz, Hint, NumericQuiz, Solution } from './practice/Quiz';

/** Components every lesson body can use without importing them. */
export const frameworkComponents = { Term, Syllabus, Beyond, ExamTip, Figure, NumericQuiz, ChoiceQuiz, Choice, Hint, Solution };
