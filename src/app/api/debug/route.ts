import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  const { data: sessions } = await supabase.from('sessions').select('*').eq('is_personal', true).order('created_at', { ascending: false });
  const { data: courses } = await supabase.from('courses').select('*');
  const { data: places } = await supabase.from('course_places').select('id, course_id, title, added_by');
  
  return NextResponse.json({
    sessions: sessions?.map(s => ({
      id: s.id, owner_name: s.owner_name, password: s.password ? 'HIDDEN' : null, created_at: s.created_at
    })),
    courses,
    places
  });
}
