// =============================================
// 🌐 CODEC — Usuarios Activos + Publicaciones Compartidas
// =============================================

let miId, miPerfil = null
let misPublicaciones = []
let usuariosConectados = {} // Aquí guardamos a TODOS

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

// Canal para compartir todo entre dispositivos
const CANAL = new BroadcastChannel('codec-red-social')

function iniciarTodo() {
  miId = 'u_' + Math.random().toString(36).slice(2, 10)
  
  miPerfil = almacen.leer('mi_perfil')
  misPublicaciones = almacen.leer('publicaciones', [])

  // Cargar mi perfil en la lista
  if (miPerfil) {
    usuariosConectados[miId] = { ...miPerfil, ultimaVez: Date.now() }
    document.getElementById('input-nombre').value = miPerfil.nombre || ''
    document.getElementById('input-apellido').value = miPerfil.apellido || ''
    actualizarFotoPerfil(miPerfil.foto || null)
  }

  // Escuchar lo que envían los demás dispositivos
  CANAL.onmessage = (e) => {
    const { tipo, datos, de } = e.data
    if (de === miId) return // Ignorar lo que yo envío

    if (tipo === 'nuevo-perfil') {
      // ✅ Aparece el usuario nuevo
      usuariosConectados[de] = { ...datos, ultimaVez: Date.now() }
      renderizarListaUsuarios()
    }
    else if (tipo === 'publicacion') {
      // ✅ Llega publicación
      if (!misPublicaciones.find(p => p.id === datos.id)) {
        misPublicaciones.unshift(datos)
        almacen.guardar('publicaciones', misPublicaciones)
        agregarPublicacion(datos, true)
      }
    }
    else if (tipo === 'solicitud-lista') {
      // Cuando alguien nuevo entra, le enviamos nuestra lista
      if (miPerfil) {
        CANAL.postMessage({
          tipo: 'lista-completa',
          datos: usuariosConectados,
          de: miId
        })
      }
    }
    else if (tipo === 'lista-completa') {
      // Recibimos la lista de todos los que ya están conectados
      Object.assign(usuariosConectados, datos)
      // Quitar usuarios viejos sin perfil
      if (miPerfil) usuariosConectados[miId] = { ...miPerfil, ultimaVez: Date.now() }
      renderizarListaUsuarios()
    }
  }

  // Pedir lista de usuarios ya conectados cuando entro
  setTimeout(() => {
    CANAL.postMessage({ tipo: 'solicitud-lista', de: miId })
  }, 500)

  // Mostrar todo
  setTimeout(() => {
    pantallaCarga.style.display = 'none'
    app.style.display = 'block'
    renderizarPublicaciones()
    renderizarListaUsuarios()
  }, 800)
}

// ===== PUBLICACIONES =====
function renderizarPublicaciones() {
  muro.innerHTML = ''
  misPublicaciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .forEach(p => agregarPublicacion(p, false))
}

function agregarPublicacion(p, alPrincipio = false) {
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
  if (!miPerfil) return alert('Crea tu perfil primero 👤')

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

  // Compartir con todos
  CANAL.postMessage({ tipo: 'publicacion', datos: nuevaPub, de: miId })

  // Limpiar
  document.getElementById('nuevo-texto').value = ''
  document.getElementById('vista-previa-archivo').innerHTML = ''
  document.getElementById('vista-previa-archivo').style.display = 'none'
  archivoSeleccionado = null
})

// ===== PERFIL =====
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
  
  // ✅ Guardar y aparecer en la lista
  usuariosConectados[miId] = { ...miPerfil, ultimaVez: Date.now() }
  almacen.guardar('mi_perfil', miPerfil)
  
  // ✅ Avisar a TODOS los dispositivos conectados
  CANAL.postMessage({ tipo: 'nuevo-perfil', datos: miPerfil, de: miId })
  
  actualizarFotoPerfil(miPerfil.foto)
  renderizarListaUsuarios() // ✅ Refrescar inmediatamente
  alert('✅ Perfil guardado! Ya apareces en Usuarios Activos')
})

// ===== LISTA DE USUARIOS ACTIVOS =====
function renderizarListaUsuarios() {
  listaUsuarios.innerHTML = ''
  
  // Filtrar: solo mostrar perfiles completos
  const activos = Object.values(usuariosConectados).filter(u => u.nombre)
  
  if (activos.length === 0) {
    listaUsuarios.innerHTML = `
      <p style="color:var(--texto-mudo);text-align:center;padding:30px;">
        👤 Nadie conectado aún<br>
        Crea tu perfil arriba y comparte el enlace
      </p>
    `
    return
  }

  activos.forEach(usuario => {
    const esYo = usuario.id === miId
    const tarjeta = document.createElement('div')
    tarjeta.className = 'tarjeta-usuario'
    tarjeta.innerHTML = `
      <div class="foto-perfil">
        ${usuario.foto ? `<img src="${usuario.foto}">` : usuario.nombre[0].toUpperCase()}
      </div>
      <div>
        <div class="usuario-nombre">${usuario.nombre} ${usuario.apellido} ${esYo ? '(Tú)' : ''}</div>
        <div class="usuario-id">Activo ✅</div>
      </div>
    `
    listaUsuarios.appendChild(tarjeta)
  })
}

// ===== CHAT =====
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
  if (!texto) return
  
  const div = document.createElement('div')
  div.className = 'mensaje mio'
  div.textContent = texto
  mensajesChat.appendChild(div)
  inputMensaje.value = ''
  mensajesChat.scrollTop = mensajesChat.scrollHeight
}

// ===== NAVEGACIÓN =====
document.querySelectorAll('.item-menu').forEach(boton => {
  boton.addEventListener('click', () => {
    document.querySelectorAll('.pagina').forEach(p => p.classList.remove('activa'))
    document.getElementById(`pagina-${boton.dataset.pagina}`).classList.add('activa')
    document.querySelectorAll('.item-menu').forEach(b => b.classList.remove('activa'))
    boton.classList.add('activa')
  })
})

window.addEventListener('load', iniciarTodo)
