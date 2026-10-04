// «اسألني» — suggested QUESTIONS for the child (labels only — never answers), by category.
// The words live in i18n: child.ask.categories.<id> and child.ask.questions.<id>.<question>.
import { MESSAGES, type UiLanguage } from '../i18n/i18n';

export const ASK_CATEGORIES = [
  { id: 'why', questions: ['pray', 'fast', 'bismillah'] },
  { id: 'prophets', questions: ['yunus', 'nuhArk', 'kaaba'] },
  { id: 'universe', questions: ['stars', 'rain'] },
  { id: 'manners', questions: ['lying', 'parents'] },
] as const;

export type AskCategoryId = (typeof ASK_CATEGORIES)[number]['id'];

type Labels = Record<string, Record<string, string>>;

export function askCategoryLabel(lang: UiLanguage, id: AskCategoryId): string {
  return (MESSAGES[lang].child.ask.categories as Record<string, string>)[id] ?? id;
}

export function askQuestionLabel(lang: UiLanguage, category: AskCategoryId, question: string): string {
  return (MESSAGES[lang].child.ask.questions as Labels)[category]?.[question] ?? question;
}
