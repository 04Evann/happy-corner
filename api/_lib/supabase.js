const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eiqbenebtmfolqxjwubc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpcWJlbmVidG1mb2xxeGp3dWJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMjQ1NTIsImV4cCI6MjA5MTYwMDU1Mn0.vycF5redWe7_R4vc9GRHbOpj9EZR9MOAeKxF8AG-Rfg';

export const supabaseFetch = async (path, method = 'GET', body = null) => {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'apiKey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
        if (method === 'POST') {
            options.headers['Prefer'] = 'return=representation';
        }
    }
    
    // Si queremos actualizar (PATCH), también pedimos representación
    if (method === 'PATCH') {
        options.headers['Prefer'] = 'return=representation';
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, options);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Supabase Error: ${JSON.stringify(data)}`);
    }
    return data;
};
