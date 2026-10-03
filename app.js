// =============================================
// 🌐 CODEC — Conectado entre todos
// =============================================

let miId, miPerfil = null
let misPublicaciones = []
let misConversaciones = {}

const almacen = {
  guardar(clave, valor) {
    localStorage.setItem(`codec_${clave}`, JSON.stringify(valor))
  },
  leer(clave, porDefecto = null) {
    const d = localStorage.getItem(`codec_${clave}`)
    return d ? JSON.parse(d) : porDefecto
  }
}

const pantallaCarga = document.getElementById('pantalla-carga')
const app = document.getElementById('app')
const muro = document.getElementById('muro')
const listaUsuarios = document.getElementById('lista-usuarios')
const listaChats = document.getElementById('lista-chats')
const ventanaChat = document.getElementById('ventana-chat')
const mensajesChat = document.getElementById('mensajes-chat')
const tituloChat = document.getElementById('titulo-chat')
const inputMensaje = document.getElementById('input-mensaje')
const contadorMensajes = document.getElementById('contador-mensajes')

// Canal público para compartir datos
const CANAL = new BroadcastChannel('codec-red-social')

function iniciarTodo() {
  miId = 'u_' + Math.random().toString(36).slice(2, 10)
  
  miPerfil = almacen.leer('mi_perfil')
  misPublicaciones = almacen.leer('publicaciones', [])
  misConversaciones = almacen.leer('conversaciones', {})

  if (miPerfil) {
    document.getElementById('input-nombre').value = miPerfil.nombre || ''
    document.getElementById('input-apellido').value = miPerfil.apellido || ''
    actualizarFotoPerfil(miPerfil.foto || null)
  }

  // Escuchar lo que publican los demás
  CANAL.onmessage = (e) => {
    const { tipo, datos, de } = e.data
    if (de === miId) return // Ignorar lo que yo mismo envío

    if (tipo === 'publicacion') {
      agregarPublicacion(datos, true)
    } else if (tipo === 'perfil') {
      // Actualizar lista de usuarios cuando alguien guarda su perfil
      renderizarListaUsuarios()
    } else if (tipo === 'mensaje') {
      recibirMensaje(datos)
    }
  }

  setTimeout(() => {
    pantallaCarga.style.display = 'none'
    app.style.display = 'block'
    renderizarPublicaciones()
    renderizarListaUsuarios()
  }, 800)
}

// --- PUBLICACIONES ---
function renderizarPublicaciones() {
  muro.innerHTML = ''
  misPublicaciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .forEach(p => agregarPublicacion(p, false))
}

function agregarPublicacion(p, alPrincipio = false) {
  if (misPublicaciones.find(x => x.id === p.id)) return // Evitar duplicados
  if (alPrincipio) {
    misPublicaciones.unshift(p)
    almacen.guardar('publicaciones', misPublicaciones)
  }

  const elem = document.createElement('div')
  elem.className = 'publicacion'
  elem.innerHTML = `
    <div class="pub-cabecera">
      <div class="foto-perfil">${p.fotoAutor ? `<img src="${p.fotoAutor}">` : (p.nombreAutor?.[0] || '?')}</div>
      <div>
        <div class="pub-autor">${p.nombreAutor || 'Anónimo'}</div>
        <div class="pub-fecha">${new Date(p.fecha).toLocaleString('es-EC')}</div>
      </div>
    </div>
    ${p.texto ? `<div class="pub-contenido">${p.texto}</div>` : ''}
    ${p.imagen ? `<div class="pub-media"><img src="${p.imagen}" alt=""></div>` : ''}
  `
  alPrincipio ? muro.prepend(elem) : muro.appendChild(elem)
}

let archivoSeleccionado = null

document.getElementById('archivo-entrada').addEventListener('change', e => {
  const arch = e.target.files[0]
  if (!arch) return
  archivoSeleccionado = arch
  const vista = document.getElementById('vista-previa-archivo')
  vista.innerHTML = ''
  if (arch.type.startsWith('image/')) {
    const img = document.createElement('img')
    img.src = URL.createObjectURL(arch)
    vista.appendChild(img)
  }
  vista.style.display = 'block'
})

document.getElementById('btn-publicar').addEventListener('click', () => {
  const texto = document.getElementById('nuevo-texto').value.trim()
  if (!texto && !archivoSeleccionado) return alert('Escribe algo 📝')
  if (!miPerfil) return alert('Crea tu perfil en "Comunidad" primero 👤')

  const nuevaPub = {
    id: Date.now() + '_' + miId,
    autorId: miId,
    nombreAutor: `${miPerfil.nombre} ${miPerfil.apellido}`,
    fotoAutor: miPerfil.foto,
    texto,
    imagen: archivoSeleccionado ? URL.createObjectURL(archivoSeleccionado) : null,
    fecha: new Date().toISOString()
  }

  misPublicaciones.unshift(nuevaPub)
  almacen.guardar('publicaciones', misPublicaciones)
  agregarPublicacion(nuevaPub, true)

  // Compartir con todos los que están conectados
  CANAL.postMessage({ tipo: 'publicacion', datos: nuevaPub, de: miId })

  // Limpiar
  document.getElementById('nuevo-texto').value = ''
  document.getElementById('vista-previa-archivo').innerHTML = ''
  document.getElementById('vista-previa-archivo').style.display = 'none'
  archivoSeleccionado = null
})

// --- PERFIL ---
document.getElementById('foto-perfil-entrada').addEventListener('change', e => {
  const arch = e.target.files[0]
  if (!arch) return
  const lector = new FileReader()
  lector.onload = ev => {
    if (!miPerfil) miPerfil = {}
    miPerfil.foto = ev.target.result
    actualizarFotoPerfil(miPerfil.foto)
  }
  lector.readAsDataURL(arch)
})

function actualizarFotoPerfil(urlFoto) {
  const elem = document.getElementById('mi-foto-grande')
  const elemMini = document.getElementById('foto-preview-mini')
  if (urlFoto) {
    elem.innerHTML = `<img src="${urlFoto}" alt="Yo">`
    elemMini.innerHTML = `<img src="${urlFoto}" alt="Yo">`
  } else if (miPerfil?.nombre) {
    const inicial = miPerfil.nombre[0].toUpperCase()
    elem.innerHTML = inicial
    elemMini.innerHTML = inicial
  }
}

document.getElementById('btn-guardar-perfil').addEventListener('click', () => {
  const nombre = document.getElementById('input-nombre').value.trim()
  const apellido = document.getElementById('input-apellido').value.trim()
  if (!nombre || !apellido) return alert('Escribe tu nombre y apellido ✍️')

  miPerfil = {
    id: miId,
    nombre,
    apellido,
    foto: miPerfil?.foto || null
  }
  almacen.guardar('mi_perfil', miPerfil)
  
  // Avisar a todos que me uní
  CANAL.postMessage({ tipo: 'perfil', datos: miPerfil, de: miId })
  
  actualizarFotoPerfil(miPerfil.foto)
  alert('✅ Perfil guardado! Comparte el enlace con amigos para que te vean')
})

// --- LISTA DE USUARIOS ---
function renderizarListaUsuarios() {
  listaUsuarios.innerHTML = `
    <p style="color:var(--texto-mudo);text-align:center;padding:20px;">
      👤 Tú: ${miPerfil ? `${miPerfil.nombre} ${miPerfil.apellido}` : 'Sin perfil'}<br>
      <small>Comparte el enlace con amigos para que aparezcan aquí</small>
    </p>
  `
}

// --- CHAT ---
let conversacionActiva = null

document.getElementById('volver-chats').addEventListener('click', () => {
  conversacionActiva = null
  ventanaChat.style.display = 'none'
  listaChats.style.display = 'flex'
  tituloChat.textContent = 'Mensajes'
})

document.getElementById('btn-enviar').addEventListener('click', enviarMensaje)
inputMensaje.addEventListener('keydown', e => e.key === 'Enter' && enviarMensaje())

function enviarMensaje() {
  const texto = inputMensaje.value.trim()
  if (!texto || !conversacionActiva) return
  
  const mensaje = {
    id: Date.now(),
    de: miId,
    para: conversacionActiva,
    texto,
    fecha: new Date().toISOString()
  }
  
  // Guardar localmente
  if (!misConversaciones[conversacionActiva]) {
    misConversaciones[conversacionActiva] = []
  }
  misConversaciones[conversacionActiva].push(mensaje)
  almacen.guardar('conversaciones', misConversaciones)
  
  // Enviar por el canal
  CANAL.postMessage({ tipo: 'mensaje', datos: mensaje, de: miId })
  
  const div = document.createElement('div')
  div.className = 'mensaje mio'
  div.textContent = texto
  mensajesChat.appendChild(div)
  inputMensaje.value = ''
  mensajesChat.scrollTop = mensajesChat.scrollHeight
}

function recibirMensaje(msg) {
  if (msg.para && msg.para !== miId) return // No es para mí
  if (!misConversaciones[msg.de]) misConversaciones[msg.de] = []
  misConversaciones[msg.de].push(msg)
  almacen.guardar('conversaciones', misConversaciones)
  
  if (conversacionActiva === msg.de) {
    const div = document.createElement('div')
    div.className = 'mensaje suyo'
    div.textContent = msg.texto
    mensajesChat.appendChild(div)
    mensajesChat.scrollTop = mensajesChat.scrollHeight
  } else {
    contadorMensajes.textContent = parseInt(contadorMensajes.textContent || 0) + 1
    contadorMensajes.style.display = 'block'
  }
}

// --- NAVEGACIÓN ---
document.querySelectorAll('.item-menu').forEach(boton => {
  boton.addEventListener('click', () => {
    document.querySelectorAll('.pagina').forEach(p => p.classList.remove('activa'))
    document.getElementById(`pagina-${boton.dataset.pagina}`).classList.add('activa')
    document.querySelectorAll('.item-menu').forEach(b => b.classList.remove('activa'))
    boton.classList.add('activa')
    conversacionActiva = null
    ventanaChat.style.display = 'none'
    listaChats.style.display = 'flex'
  })
})

window.addEventListener('load', iniciarTodo)
