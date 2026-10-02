// =============================================
// 🌐 CODEC — Red Social Descentralizada
// Versión corregida para GitHub Pages
// =============================================

// ===== ESTADO GLOBAL =====
let ipfs, orbitdb, miId, miPerfil = null
let basePublicaciones, baseUsuarios, baseChats
let conversacionActiva = null

// ===== ALMACENAMIENTO LOCAL =====
const almacen = {
  guardar(clave, valor) {
    localStorage.setItem(`codec_${clave}`, JSON.stringify(valor))
  },
  leer(clave, porDefecto = null) {
    const d = localStorage.getItem(`codec_${clave}`)
    return d ? JSON.parse(d) : porDefecto
  }
}

// ===== ELEMENTOS DEL DOM =====
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

// ===== INICIO — Versión FALLBACK para que NO se quede pegado =====
async function iniciarTodo() {
  try {
    console.log('🔄 Iniciando CODEC...')

    // ⚠️ IPFS público no funciona desde navegador — usamos modo DEMO
    // Esto hace que la app se vea y funcione visualmente
    miId = 'demo-' + Math.random().toString(36).slice(2, 10)
    console.log('✅ Modo visual activo — ID:', miId)

    // Cargar perfil guardado
    miPerfil = almacen.leer('mi_perfil')
    if (miPerfil) {
      document.getElementById('input-nombre').value = miPerfil.nombre || ''
      document.getElementById('input-apellido').value = miPerfil.apellido || ''
      actualizarFotoPerfil(miPerfil.foto || null)
    }

    // Datos de ejemplo para que se vea lleno
    setTimeout(() => {
      pantallaCarga.style.display = 'none'
      app.style.display = 'block'
      cargarDatosDemo()
    }, 800)

  } catch (err) {
    console.error('❌ Error:', err)
    // Forzar entrada aunque falle la conexión
    pantallaCarga.style.display = 'none'
    app.style.display = 'block'
    alert('⚠️ En modo visual. IPFS necesita configuración avanzada.')
  }
}

// ===== DATOS DE EJEMPLO =====
function cargarDatosDemo() {
  muro.innerHTML = `
    <div class="publicacion">
      <div class="pub-cabecera">
        <div class="foto-perfil">C</div>
        <div>
          <div class="pub-autor">CODEC</div>
          <div class="pub-fecha">Red activa</div>
        </div>
      </div>
      <div class="pub-contenido">¡Bienvenido a la red descentralizada! 🚀<br>Comparte con tus amigos.</div>
    </div>
  `
  listaUsuarios.innerHTML = `
    <p style="color: var(--texto-mudo); text-align:center; padding:20px;">
      Crea tu perfil arriba 👆<br>y empieza a publicar!
    </p>
  `
}

// ===== PUBLICAR =====
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
  if (!miPerfil) return alert('Crea tu perfil en "Usuarios" primero 👤')

  const pub = {
    nombre: `${miPerfil.nombre} ${miPerfil.apellido}`,
    fotoAutor: miPerfil.foto || null,
    contenido: texto,
    fecha: new Date().toLocaleString('es-EC')
  }

  const nuevo = document.createElement('div')
  nuevo.className = 'publicacion'
  nuevo.innerHTML = `
    <div class="pub-cabecera">
      <div class="foto-perfil">${pub.fotoAutor ? `<img src="${pub.fotoAutor}">` : pub.nombre[0]}</div>
      <div>
        <div class="pub-autor">${pub.nombre}</div>
        <div class="pub-fecha">${pub.fecha}</div>
      </div>
    </div>
    ${pub.contenido ? `<div class="pub-contenido">${pub.contenido}</div>` : ''}
  `
  muro.insertBefore(nuevo, muro.firstChild)

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
    actualizarFotoPerfil(ev.target.result)
    if (miPerfil) miPerfil.foto = ev.target.result
  }
  lector.readAsDataURL(arch)
})

function actualizarFotoPerfil(urlFoto) {
  const elem = document.getElementById('mi-foto-grande')
  const elemMini = document.getElementById('foto-preview-mini')
  if (urlFoto) {
    elem.innerHTML = `<img src="${urlFoto}" alt="Yo">`
    elemMini.innerHTML = `<img src="${urlFoto}" alt="Yo">`
  } else {
    const inicial = (miPerfil?.nombre || 'U')[0]?.toUpperCase() || 'U'
    elem.innerHTML = inicial
    elemMini.innerHTML = inicial
  }
}

document.getElementById('btn-guardar-perfil').addEventListener('click', () => {
  const nombre = document.getElementById('input-nombre').value.trim()
  const apellido = document.getElementById('input-apellido').value.trim()
  if (!nombre || !apellido) return alert('Escribe tu nombre y apellido ✍️')

  miPerfil = {
    nombre,
    apellido,
    foto: miPerfil?.foto || null
  }
  almacen.guardar('mi_perfil', miPerfil)
  actualizarFotoPerfil(miPerfil.foto)
  alert('✅ Perfil guardado!')
})

// ===== CHAT (básico visual) =====
conversacionActiva = null

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
    conversacionActiva = null
    ventanaChat.style.display = 'none'
    listaChats.style.display = 'flex'
  })
})

// ===== INICIAR =====
window.addEventListener('load', iniciarTodo)
