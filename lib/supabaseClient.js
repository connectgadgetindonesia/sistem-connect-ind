import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zdxkxehyryaecnrngnqa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkeGt4ZWh5cnlhZWNucm5nbnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTA5MzYsImV4cCI6MjA2ODY2NjkzNn0.PxtAJD9ptOU1NnRnHU4Fs68tc1RMO8I8NyXmxiWnf5o'

export const supabase = createClient(supabaseUrl, supabaseKey)
