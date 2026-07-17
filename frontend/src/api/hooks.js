import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from './client'

/* ----------------------------- Query keys ----------------------------- */
export const keys = {
  dashboard: ['dashboard'],
  tasks: (params) => ['tasks', params || {}],
  activity: ['activity'],
  calendars: ['calendars'],
  invites: ['invites'],
  weather: (loc) => ['weather', loc || 'default'],
  quote: ['quote'],
  history: ['history'],
}

const invalidateBoard = (qc) => {
  qc.invalidateQueries({ queryKey: ['tasks'] })
  qc.invalidateQueries({ queryKey: keys.dashboard })
  qc.invalidateQueries({ queryKey: keys.activity })
}

/* ----------------------------- Dashboard ------------------------------ */
export function useDashboard() {
  return useQuery({
    queryKey: keys.dashboard,
    queryFn: async () => (await api.get('/dashboard')).data,
    staleTime: 15_000,
  })
}

/* ------------------------------- Tasks -------------------------------- */
export function useTasks(params) {
  return useQuery({
    queryKey: keys.tasks(params),
    queryFn: async () => (await api.get('/tasks', { params })).data,
    staleTime: 10_000,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => (await api.post('/tasks', payload)).data,
    onSuccess: () => {
      invalidateBoard(qc)
      toast.success('Task created')
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Could not create task'),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }) => (await api.patch(`/tasks/${id}`, patch)).data,
    onSuccess: () => {
      invalidateBoard(qc)
      toast.success('Task updated')
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Could not update task'),
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, completed = true }) =>
      (await api.post(`/tasks/${id}/complete`, null, { params: { completed } })).data,
    // Optimistic: flip status locally before the server responds.
    onMutate: async ({ id, completed = true }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const snapshots = qc.getQueriesData({ queryKey: ['tasks'] })
      snapshots.forEach(([key, data]) => {
        if (!data?.items) return
        qc.setQueryData(key, {
          ...data,
          items: data.items.map((t) =>
            t.id === id ? { ...t, status: completed ? 'completed' : 'pending' } : t
          ),
        })
      })
      return { snapshots }
    },
    onError: (e, _vars, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data))
      toast.error(e?.response?.data?.detail || 'Could not update task')
    },
    onSettled: () => invalidateBoard(qc),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/tasks/${id}`)).data,
    onSuccess: () => {
      invalidateBoard(qc)
      toast.success('Task deleted')
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Could not delete task'),
  })
}

/* ------------------------------ Activity ------------------------------ */
export function useActivity(limit = 15) {
  return useQuery({
    queryKey: keys.activity,
    queryFn: async () => (await api.get('/activity', { params: { limit } })).data,
    staleTime: 15_000,
  })
}

/* ----------------------------- Calendars ------------------------------ */
export function useCalendars() {
  return useQuery({
    queryKey: keys.calendars,
    queryFn: async () => (await api.get('/calendars')).data,
  })
}

/* ------------------------------ Invites ------------------------------- */
export function useInvites() {
  return useQuery({
    queryKey: keys.invites,
    queryFn: async () => (await api.get('/invites')).data,
  })
}

export function useCreateInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => (await api.post('/invites', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.invites })
      toast.success('Invitation sent')
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Could not send invitation'),
  })
}

export function useInviteAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action }) => (await api.post(`/invites/${id}/${action}`)).data,
    onSuccess: (_d, { action }) => {
      qc.invalidateQueries({ queryKey: keys.invites })
      qc.invalidateQueries({ queryKey: keys.calendars })
      toast.success(`Invitation ${action}d`)
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Action failed'),
  })
}

/* --------------------------- Home widgets ----------------------------- */
export function useQuote() {
  return useQuery({
    queryKey: keys.quote,
    queryFn: async () => (await api.get('/quotes/random')).data,
    staleTime: 0,
    gcTime: 0,
  })
}

export function useWeather(location) {
  return useQuery({
    queryKey: keys.weather(location),
    queryFn: async () =>
      (await api.get('/weather', { params: location ? { location } : {} })).data,
    staleTime: 5 * 60_000,
  })
}

export function useOnThisDay() {
  return useQuery({
    queryKey: keys.history,
    queryFn: async () => (await api.get('/history/on-this-day')).data,
    staleTime: 0,
    gcTime: 0,
  })
}
