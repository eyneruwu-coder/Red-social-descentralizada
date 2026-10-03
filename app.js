// =============================================
// 🌐 CODEC — CONECTA TODOS LOS TELÉFONOS
// =============================================

let miId, miPerfil = null
let db = null
let usuariosRef = null
let publicacionesRef = null
let misPublicaciones = []
let usuariosConectados = {}

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

// 🔧 CONFIGURACIÓN — Esto es público y GRATIS
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCqDpV4GQqFhGd9KZ8xY7w6rT5s4P3n2m1b0",
  authDomain: "codec-red-social.firebaseapp.com",
  databaseURL: "https://codec-red-social-default-rtdb.firebaseio.com",
  projectId: "codec-red-social",
  storageBucket: "codec-red-social.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456ghi789jkl01"
}

function iniciarTodo() {
  miId = 'u_' + Math.random().toString(36).slice(2, 10)
  
  // Inicializar base de datos gratuita
  try {
    const app = firebase.initializeApp(FIREBASE_CONFIG)
    db = firebase.database()
    usuariosRef = db.ref('usuarios')
    publicacionesRef = db.ref('publicaciones')
    console.log('✅ Conectado a la red CODEC')
  } catch (error) {
    console.log('⚠️ Modo local — sin conexión entre dispositivos')
  }

  // Cargar mi perfil guardado
  miPerfil = almacen.leer('mi_perfil')
  if (miPerfil) {
    document.getElementById('input-nombre').value = miPerfil.nombre || ''
    document.getElementById('input-apellido').value = miPerfil.apellido || ''
    actualizarFotoPerfil(miPerfil.foto || null)
  }

  // Escuchar cuando alguien se conecte o actualice su perfil
  if (db) {
    usuariosRef.on('value', (snapshot) => {
      const todos = snapshot.val() || {}
      usuariosConectados = todos
      renderizarListaUsuarios()
    })

    // Escuchar publicaciones nuevas
    publicacionesRef.limitToLast(20).on('value', (snapshot) => {
      const datos = snapshot.val() || {}
      misPublicaciones = Object.values(datos).reverse()
      renderizarPublicaciones()
    })
  }

  // Mostrar interfaz
  setTimeout(() => {
    pantallaCarga.style.display = 'none'
    app.style.display = 'block'
    renderizarListaUsuarios()
    renderizarPublicaciones()
  }, 800)
}

// ===== GUARDAR PERFIL — APARECE EN TODOS LOS TELÉFONOS =====
document.getElementById('btn-guardar-perfil').addEventListener('click', () => {
  const nombre = document.getElementById('input-nombre').value.trim()
  const apellido = document.getElementById('input-apellido').value.trim()
  if (!nombre || !apellido) return alert('Escribe tu nombre y apellido ✍️')

  miPerfil = {
    id: miId,
    nombre,
    apellido,
    foto: miPerfil?.foto || null,
    ultimaConexion: new Date().toISOString()
  }
  
  almacen.guardar('mi_perfil', miPerfil)
  actualizarFotoPerfil(miPerfil.foto)

  // ⚡ Enviar a la base de datos — APARECE EN TODOS
  if (db) {
    usuariosRef.child(miId).set(miPerfil)
      .then(() => alert('✅ Perfil guardado! Ya te ven todos 👀'))
      .catch(() => alert('⚠️ Guardado localmente. Revisa conexión.'))
  } else {
    alert('✅ Guardado localmente')
  }
})

// ===== LISTA DE USUARIOS =====
function renderizarListaUsuarios() {
  listaUsuarios.innerHTML = ''
  const todos = Object.values(usuariosConectados).filter(u => u && u.nombre)

  if (todos.length === 0) {
    listaUsuarios.innerHTML = `
      <p style="color:var(--texto-mudo);text-align:center;padding:30px;">
        👤 Crea tu perfil arriba<br>y verás a los demás aquí
      </p>
    `
    return
  }

  todos.forEach(usuario => {
    const esYo = usuario.id === miId
    const tarjeta = document.createElement('div')
    tarjeta.className = 'tarjeta-usuario'
    tarjeta.innerHTML = `
      <div class="foto-perfil">
        ${usuario.foto ? `<img src="${usuario.foto}">` : usuario.nombre[0].toUpperCase()}
      </div>
      <div>
        <div class="usuario-nombre">
          ${usuario.nombre} ${usuario.apellido}
          ${esYo ? '<span style="color:var(--resaltado);font-size:0.8em;">(Tú)</span>' : ''}
        </div>
        <div class="usuario-id">${esYo ? 'Conectado ✅' : 'Activo ✅'}</div>
      </div>
    `
    listaUsuarios.appendChild(tarjeta)
  })
}

// ===== FOTO DE PERFIL =====
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

// ===== PUBLICACIONES =====
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

  // Enviar a TODOS los dispositivos
  if (db) {
    publicacionesRef.push(nuevaPub)
  }

  // Limpiar
  document.getElementById('nuevo-texto').value = ''
  document.getElementById('vista-previa-archivo').innerHTML = ''
  document.getElementById('vista-previa-archivo').style.display = 'none'
  archivoSeleccionado = null
})

function renderizarPublicaciones() {
  muro.innerHTML = ''
  misPublicaciones.forEach(p => {
    if (!p) return
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
    muro.appendChild(elem)
  })
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
