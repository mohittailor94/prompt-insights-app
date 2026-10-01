import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useGetInsightsQuery, useSubmitPromptMutation } from './services/api';
import { PromptForm } from './components/PromptForm';
import { ResultsPanel } from './components/ResultsPanel';
import { promptSchema } from './validation/promptSchema';

const languageOptions = [['en', 'English'], ['de', 'Deutsch'], ['fr', 'Français'], ['es', 'Español'], ['it', 'Italiano']];

export default function App() {
  const [form, setForm] = useState({ prompt: '', targetLanguage: 'en' });
  const [formError, setFormError] = useState('');
  const [session, setSession] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [submitPrompt, submitState] = useSubmitPromptMutation();
  const queryArgs = useMemo(() => ({ prompt: session?.prompt || '', targetLanguage: session?.targetLanguage || 'en', page, search: debouncedSearch }), [session?.prompt, session?.targetLanguage, page, debouncedSearch]);
  const result = useGetInsightsQuery(queryArgs, { skip: !session });

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    const parsed = promptSchema.safeParse(form);
    if (!parsed.success) { setFormError(parsed.error.issues[0].message); return; }
    setFormError('');
    setPage(1);
    const response = await submitPrompt(parsed.data);
    if (!response.error && response.data.status === 'SUCCESS') setSession({ ...parsed.data, contextId: response.data.contextId });
  }, [form, submitPrompt]);

  const handleFormChange = useCallback((nextForm) => setForm(nextForm), []);
  const handleSearchChange = useCallback((nextSearch) => setSearch(nextSearch), []);
  const handlePreviousPage = useCallback(() => setPage((currentPage) => currentPage - 1), []);
  const handleNextPage = useCallback(() => setPage((currentPage) => currentPage + 1), []);

  return <main className="shell"><header className="topbar"><div className="brand"><span className="brand-mark"><Sparkles size={16} /></span><span>SIGNAL<span className="brand-slash">/</span>AI</span></div><span className="status"><i /> middleware online</span></header>
    <section className="workspace"><PromptForm form={form} formError={formError} isLoading={submitState.isLoading} submitError={submitState.error} languageOptions={languageOptions} onChange={handleFormChange} onSubmit={handleSubmit} /><ResultsPanel session={session} submitData={submitState.data} result={result} search={search} page={page} onSearchChange={handleSearchChange} onPreviousPage={handlePreviousPage} onNextPage={handleNextPage} /></section>
    </main>;
}