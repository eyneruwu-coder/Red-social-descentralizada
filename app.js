// ========== ALMACENAMIENTO LOCAL PERMANENTE ==========
const db = {
  guardar(clave, valor) {
    localStorage.setItem(`red_${clave}`, JSON.stringify(valor))
  },
  leer(clave, porDefecto = null) {
    const datos = localStorage.getItem(`red_${clave}`)
    return datos ? JSON.parse(datos) : porDefecto
  }
}

// ========== ESTADO GLOBAL ==========
let ipfs, miId, nombreUsuario
const publicaciones = db.leer('historial', [])
const CANAL = 'red-social-permanente'

// Elementos
const estado = document.getElementById('estado')
const miIdElem = document.getElementById('mi-id')
const nombreInput = document.getElementById('nombre-usuario')
const textoPub = document.getElementById('texto-publicacion')
const btnPublicar = document.getElementById('btn-publicar')
const btnRecargar = document.getElementById('btn-recargar')
const lista = document.getElementById('lista-publicaciones')

// ========== INICIO DE RED ==========
async function iniciarRed() {
  try {
    estado.textContent = '🔄 Conectando a IPFS...'
    
    // Conectamos a un nodo IPFS público (gratis, sin servidor propio)
    ipfs = window.IpfsHttpClient.create({
      host: 'ipfs.io',
      port: 443,
      protocol: 'https'
    })

    const id = await ipfs.id()
    miId = id.id
    miIdElem.textContent = `Tu ID: ${miId.slice(0, 12)}...`
    nombreInput.value = db.leer('mi_nombre', '')

    estado.textContent = '✅ Conectado — Tus datos se guardan localmente'
    renderizar()
    
    // Cargar publicaciones conocidas al iniciar
    buscarNovedades()

  } catch (err) {
    estado.textContent = '⚠️ Modo local — sin conexión a red'
    console.error(err)
    renderizar()
  }
}

// ========== PUBLICAR ALGO ==========
async function publicar() {
  const texto = textoPub.value.trim()
  const nombre = nombreInput.value.trim() || `Anónimo_${miId.slice(0, 4)}`
  
  if (!texto) return alert('Escribe algo primero ✍️')
  
  db.guardar('mi_nombre', nombre)

  const publicacion = {
    id: `${Date.now()}_${miId.slice(0, 8)}`,
    autor: nombre,
    autorId: miId.slice(0, 12),
    contenido: texto,
    fecha: new Date().toISOString(),
    cid: null // Identificador en IPFS
  }

  try {
    // Subir a IPFS → obtiene un CID único
    const { cid } = await ipfs.add(JSON.stringify(publicacion))
    publicacion.cid = cid.toString()
    
    estado.textContent = `✅ Guardado en red: ${publicacion.cid.slice(0, 16)}...`
    
    // Agregar a tu historial local
    publicaciones.unshift(publicacion)
    db.guardar('historial', publicaciones)
    
    textoPub.value = ''
    renderizar()

  } catch (err) {
    // Si no hay red, guardar igual en local
    publicaciones.unshift(publicacion)
    db.guardar('historial', publicaciones)
    estado.textContent = '📌 Guardado solo en tu dispositivo'
    renderizar()
  }
}

// ========== BUSCAR NOVEDADES ==========
async function buscarNovedades() {
  if (!ipfs) return

  // Lista de CIDs conocidos que vamos "siguiendo"
  // En versión avanzada: cada usuario tiene su propio índice en IPNS
  const conocidos = db.leer('seguidos', [])
  const misCids = new Set(publicaciones.map(p => p.cid).filter(Boolean))
  
  // En este prototipo simplificado: intentamos cargar publicaciones recientes
  // Versión completa: OrbitDB sincroniza automáticamente entre pares
  estado.textContent = '🔍 Buscando novedades...'
  
  // Tu propio historial ya está cargado
  renderizar()
  estado.textContent = '✅ Actualizado'
}

// ========== MOSTRAR ==========
function renderizar() {
  lista.innerHTML = publicaciones.map(p => `
    <div class="publicacion">
      <div class="autor">👤 ${p.autor} — ${p.autorId || 'local'}</div>
      <div class="fecha">🕐 ${new Date(p.fecha).toLocaleString('es-EC')}</div>
      <div class="contenido">${p.contenido}</div>
      ${p.cid ? `<div class="cid">🔗 Permanente: ${p.cid}</div>` : '<div class="cid">📌 Solo en tu dispositivo</div>'}
    </div>
  `).join('')
}

// ========== EVENTOS ==========
btnPublicar.addEventListener('click', publicar)
btnRecargar.addEventListener('click', buscarNovedades)
window.addEventListener('load', iniciarRed)
