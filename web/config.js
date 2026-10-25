// config.js — lo único que hay que editar para cambiar de modo o de proyecto.
//
//   modo "auto":  si la página la sirve `node servidor/servidor.js` (hotspot), usa el servidor local;
//                 si la sirve Cloudflare Pages, usa Supabase. No hay que tocar nada para cambiar.
//   modo "nube" / "local": forzar uno de los dos.
export const CONFIG = {
  modo: "auto",

  // Supabase → Project Settings → API (o "Connect"): Project URL y la clave pública (anon / publishable).
  // La clave pública está hecha para ir en el navegador; lo que protege la tabla son las políticas RLS.
  supabaseUrl: "https://wreabvhsnxfysvlhavgu.supabase.co",
  supabaseKey: "sb_publishable_rEjppfq1LVQt9X4BWsxFcQ_5uCrvFfq",

  // Link que se muestra en la pantalla de la laptop (el mismo del QR). Vacío = el dominio actual.
  urlPublica: "",

  // Encabezado fijo con el que empieza todo mensaje. Lo usan el celular, la pantalla y la Bombe.
  crib: "FERIABEADRAGONENLAUSFQ",
};
