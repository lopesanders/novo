const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('downloadBtn');
const shareBtn = document.getElementById('shareBtn');
const loadingMessage = document.getElementById('loadingMessage');
const instructionMessage = document.getElementById('instructionMessage');

// --- CONFIGURAÇÃO ---
const templateImagePath = 'template.png'; // Certifique-se que este arquivo existe!
const outputFilename = 'minha-imagem-personalizada.png';
const ZOOM_SENSITIVITY = 0.002; // Ajuste a sensibilidade do zoom do scroll do mouse
const MIN_ZOOM = 0.1; // Zoom mínimo permitido
const MAX_ZOOM = 5.0; // Zoom máximo permitido
// --- FIM DA CONFIGURAÇÃO ---

let userImage = null;
let templateImage = null;
let combinedImageBlob = null;

// Estado da imagem do usuário
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Estado do arraste (pan) e toque
let isDragging = false;
let lastDragX; // Para pan com mouse ou 1 dedo
let lastDragY;

// Estado do Pinch Zoom
let isPinching = false;
let initialPinchDistance = null;
let pinchStartScale = null;

// Variáveis para armazenar as dimensões do template
let templateWidth = 0;
let templateHeight = 0;

// --- Funções Auxiliares ---

// Calcula a distância Euclidiana entre dois pontos (dedos)
function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Calcula o ponto médio entre dois toques, relativo ao canvas
function getMidpoint(touch1, touch2, canvasRect) {
    return {
        x: ((touch1.clientX + touch2.clientX) / 2) - canvasRect.left,
        y: ((touch1.clientY + touch2.clientY) / 2) - canvasRect.top
    };
}

// Pega a posição do evento (mouse ou primeiro toque) relativa ao canvas
function getEventCanvasLocation(e, canvasRect) {
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.clientX && e.clientY) {
        clientX = e.clientX;
        clientY = e.clientY;
    } else {
        return null; // Não foi possível determinar a localização
    }
    return {
        x: clientX - canvasRect.left,
        y: clientY - canvasRect.top
    };
}


// Carrega a imagem do template e define as dimensões do canvas
function loadTemplateAndSetupCanvas() {
    // (Função sem alterações da versão anterior)
    return new Promise((resolve, reject) => {
        templateImage = new Image();
        templateImage.onload = () => {
            templateWidth = templateImage.naturalWidth;
            templateHeight = templateImage.naturalHeight;
            canvas.width = templateWidth;
            canvas.height = templateHeight;
            resolve(templateImage);
        };
        templateImage.onerror = (err) => {
            console.error("Erro ao carregar a imagem do template:", err);
            alert(`Erro ao carregar o template (${templateImagePath}). Verifique se o arquivo existe.`);
            reject(err);
        };
        templateImage.src = templateImagePath;
    });
}

// Redesenha o canvas
function redrawCanvas() {
    // (Função sem alterações significativas na lógica de desenho)
    if (!userImage || !templateImage) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.drawImage(
        userImage,
        offsetX,
        offsetY,
        userImage.naturalWidth * scale,
        userImage.naturalHeight * scale
    );
    ctx.restore();
    ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);
    prepareShare(); // Prepara para compartilhamento a cada redesenho (pode otimizar)
}

// Calcula a transformação inicial da imagem
function setInitialImageTransform() {
    // (Função sem alterações da versão anterior)
    if (!userImage || !templateImage) return;
    const imgWidth = userImage.naturalWidth;
    const imgHeight = userImage.naturalHeight;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    scale = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);
    scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale)); // Garante que esteja dentro dos limites
    offsetX = (canvasWidth - imgWidth * scale) / 2;
    offsetY = (canvasHeight - imgHeight * scale) / 2;
    redrawCanvas();
}


// Listener para carregamento de arquivo
imageLoader.addEventListener('change', async (event) => {
    // (Função sem alterações significativas da versão anterior)
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem válido.');
        imageLoader.value = '';
        return;
    }
    loadingMessage.style.display = 'block';
    instructionMessage.style.display = 'none';
    downloadBtn.disabled = true;
    shareBtn.style.display = 'none';
    canvas.style.cursor = 'default';
    isDragging = false; // Reseta estados
    isPinching = false;

    try {
        await loadTemplateAndSetupCanvas();
        const userImagePromise = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                userImage = new Image();
                userImage.onload = resolve;
                userImage.onerror = reject;
                userImage.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        await userImagePromise;
        setInitialImageTransform();
        downloadBtn.disabled = false;
        loadingMessage.style.display = 'none';
        instructionMessage.style.display = 'block';
        canvas.style.cursor = 'grab';
    } catch (error) {
        console.error("Erro no processo de carregamento:", error);
        alert("Ocorreu um erro ao carregar as imagens. Tente novamente.");
        loadingMessage.style.display = 'none';
        instructionMessage.style.display = 'none';
        downloadBtn.disabled = true;
        shareBtn.style.display = 'none';
        imageLoader.value = '';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        userImage = null;
    }
});

// --- Event Handlers para Mouse (Pan + Zoom com Scroll) ---

canvas.addEventListener('mousedown', (e) => {
    if (!userImage || isPinching) return; // Não inicia drag do mouse se estiver pinchando
    isDragging = true;
    const location = getEventCanvasLocation(e, canvas.getBoundingClientRect());
    lastDragX = location.x - offsetX; // Posição relativa ao canto da imagem
    lastDragY = location.y - offsetY;
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || !userImage || isPinching) return;
    const location = getEventCanvasLocation(e, canvas.getBoundingClientRect());
    offsetX = location.x - lastDragX;
    offsetY = location.y - lastDragY;
    redrawCanvas();
    e.preventDefault();
});

canvas.addEventListener('mouseup', () => {
    if (!userImage) return;
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
    }
});

canvas.addEventListener('mouseleave', () => {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
    }
});

canvas.addEventListener('wheel', (e) => {
    // (Função sem alterações da versão anterior - scroll zoom)
    if (!userImage || isPinching) return; // Não faz zoom com roda se estiver pinchando
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const imgX = (mouseX - offsetX) / scale;
    const imgY = (mouseY - offsetY) / scale;
    let delta = e.deltaY * ZOOM_SENSITIVITY;
    let newScale = scale - delta;
    newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
    offsetX = mouseX - imgX * newScale;
    offsetY = mouseY - imgY * newScale;
    scale = newScale;
    redrawCanvas();
});

// --- Event Handlers para Touch (Pan com 1 dedo + Pinch Zoom com 2 dedos) ---

canvas.addEventListener('touchstart', (e) => {
    if (!userImage) return;
    e.preventDefault(); // Previne comportamento padrão (scroll, zoom do navegador)
    const touches = e.touches;
    const rect = canvas.getBoundingClientRect();

    if (touches.length === 1) {
        // Início do Pan com 1 dedo
        isDragging = true;
        isPinching = false; // Garante que não está pinchando
        const location = getEventCanvasLocation(e, rect);
        lastDragX = location.x - offsetX; // Posição relativa ao canto da imagem
        lastDragY = location.y - offsetY;
        // console.log("Start Pan (1 touch)");

    } else if (touches.length === 2) {
        // Início do Pinch Zoom com 2 dedos
        isDragging = false; // Para o pan
        isPinching = true;
        initialPinchDistance = getDistance(touches[0], touches[1]);
        pinchStartScale = scale; // Armazena a escala atual no início do pinch
        // console.log("Start Pinch (2 touches)");
    }
});

canvas.addEventListener('touchmove', (e) => {
    if (!userImage) return;
    e.preventDefault();
    const touches = e.touches;
    const rect = canvas.getBoundingClientRect();

    if (isDragging && touches.length === 1) {
        // Continua o Pan com 1 dedo
        const location = getEventCanvasLocation(e, rect);
        offsetX = location.x - lastDragX;
        offsetY = location.y - lastDragY;
        redrawCanvas();
        // console.log("Moving Pan (1 touch)");

    } else if (isPinching && touches.length === 2) {
        // Continua o Pinch Zoom com 2 dedos
        const currentDistance = getDistance(touches[0], touches[1]);
        if (initialPinchDistance == null || pinchStartScale == null) return; // Segurança

        // Calcula a nova escala baseada na mudança da distância
        const scaleFactor = currentDistance / initialPinchDistance;
        let newScale = pinchStartScale * scaleFactor;

        // Limita a escala
        newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

        // Calcula o ponto médio atual entre os dedos (relativo ao canvas)
        const midpoint = getMidpoint(touches[0], touches[1], rect);

        // Calcula o fator de mudança de escala para ajustar o offset
        // Evita recalcular a posição da imagem, ajusta o offset diretamente
        const scaleDelta = newScale / scale; // Quanto a escala mudou nesta iteração

        // Ajusta o offset para que o ponto médio permaneça estável na tela
        offsetX = midpoint.x - (midpoint.x - offsetX) * scaleDelta;
        offsetY = midpoint.y - (midpoint.y - offsetY) * scaleDelta;

        // Atualiza a escala global
        scale = newScale;

        redrawCanvas();
        // console.log("Moving Pinch (2 touches), newScale:", newScale);
    }
});

canvas.addEventListener('touchend', (e) => {
    if (!userImage) return;
    // Não precisa de preventDefault aqui geralmente
    const touches = e.touches;

    if (e.touches.length === 0) {
        // Último dedo levantado
        isDragging = false;
        isPinching = false;
        initialPinchDistance = null;
        pinchStartScale = null;
        canvas.style.cursor = 'grab'; // Restaura cursor do mouse (se aplicável)
        // console.log("End All Touches");

    } else if (e.touches.length === 1 && isPinching) {
        // Um dedo levantado durante um pinch (o outro permanece)
        // Transiciona de volta para o modo Pan com o dedo restante
        isPinching = false;
        isDragging = true;
        initialPinchDistance = null;
        pinchStartScale = null;
        // Atualiza a posição inicial do pan para o dedo restante
        const rect = canvas.getBoundingClientRect();
        const location = getEventCanvasLocation(e, rect); // Pega a posição do dedo restante
        lastDragX = location.x - offsetX;
        lastDragY = location.y - offsetY;
        // console.log("End Pinch, Start Pan (1 touch remains)");
    }
    // Se touches.length >= 2 (caso raro onde um dedo levanta mas >1 permanecem),
    // o estado de pinch deve continuar (não fazemos nada de especial aqui).
});


// --- Botão de Download ---
downloadBtn.addEventListener('click', () => {
    // (Função sem alterações da versão anterior)
    if (!userImage || !templateImage) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = outputFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- Funcionalidade de Compartilhamento ---
function prepareShare() {
    // (Função sem alterações significativas - apenas verifica se canvas tem tamanho)
    if (!navigator.share || !canvas || canvas.width === 0 || canvas.height === 0) {
         shareBtn.style.display = 'none';
         combinedImageBlob = null;
        return;
    }
    canvas.toBlob( (blob) => {
        if (blob) {
            combinedImageBlob = blob;
            if(downloadBtn.disabled === false) { // Só mostra se imagem carregada
                 shareBtn.style.display = 'inline-block';
            }
        } else {
            console.error("Falha ao criar Blob da imagem para compartilhamento.");
            shareBtn.style.display = 'none';
             combinedImageBlob = null;
        }
    }, 'image/png');
}

shareBtn.addEventListener('click', async () => {
    // (Função sem alterações da versão anterior)
    if (!combinedImageBlob) {
        alert("A imagem ainda não está pronta para compartilhar ou ocorreu um erro.");
        return;
    }
    const shareData = {
        files: [ new File([combinedImageBlob], outputFilename, { type: combinedImageBlob.type }) ],
        title: 'Minha Imagem Personalizada',
        text: 'Veja a imagem que criei!',
    };
    try {
        await navigator.share(shareData);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Erro ao compartilhar:', err);
            alert(`Erro ao compartilhar: ${err.message}`);
        }
    }
});

// --- Limpeza Inicial ---
window.addEventListener('load', () => {
    // (Função sem alterações da versão anterior)
    imageLoader.value = '';
    loadingMessage.style.display = 'none';
    instructionMessage.style.display = 'none';
    downloadBtn.disabled = true;
    shareBtn.style.display = 'none';
});
