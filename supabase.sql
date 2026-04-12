-- === COPIA Y PEGA TODO ESTO EN EL 'SQL EDITOR' DE SUPABASE ===

-- 1. Tabla de Deudas
CREATE TABLE public.deudas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nombre TEXT NOT NULL,
    monto BIGINT DEFAULT 0,
    detalle TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ultima_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla de Órdenes (Para que el servidor nunca se apague por inactividad)
CREATE TABLE public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    orderCode TEXT NOT NULL,
    nombre TEXT,
    whatsapp TEXT,
    resumen TEXT,
    total TEXT,
    estado TEXT DEFAULT 'pendiente',
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Habilitar el acceso sin problemas usando el anon key (Row Level Security en modo abierto para empezar)
ALTER TABLE public.deudas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
