import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const path = url.pathname

    // Root endpoint - test connection
    if (path === '/webhook' && req.method === 'GET') {
      return new Response(
        JSON.stringify({ 
          status: 'connected', 
          message: 'Supabase Edge Function is running!',
          endpoint: '/webhook'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Webhook endpoint
    if (path === '/webhook' && req.method === 'POST') {
      const payload = await req.json()
      
      console.log('Webhook received:', payload)
      
      // Example: Save to database (uncomment when you have a table)
      // const { data, error } = await supabase
      //   .from('webhooks')
      //   .insert([{ payload, created_at: new Date().toISOString() }])
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook received',
          data: payload 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Get data endpoint
    if (path === '/webhook/data' && req.method === 'GET') {
      const table = url.searchParams.get('table')
      
      if (!table) {
        return new Response(
          JSON.stringify({ error: 'Table name required' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      const { data, error } = await supabase
        .from(table)
        .select('*')
      
      if (error) throw error
      
      return new Response(
        JSON.stringify({ data }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

