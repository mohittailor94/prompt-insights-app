import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'insightsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  keepUnusedDataFor: 300,
  tagTypes: ['Insights'],
  endpoints: (builder) => ({
    submitPrompt: builder.mutation({
      query: (body) => ({ url: '/prompts', method: 'POST', body }),
    }),
    getInsights: builder.query({
      query: ({ prompt, targetLanguage, page, search }) => ({ url: '/insights', params: { prompt, targetLanguage, page, pageSize: 10, search } }),
      providesTags: ['Insights'],
    }),
  }),
});

export const { useSubmitPromptMutation, useGetInsightsQuery } = api;