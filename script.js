// Este arquivo pode ser usado para adicionar funcionalidades no futuro
console.log("Rádio Sol FM está ao vivo!");

// Variáveis globais para o espectro de áudio
let audioContext;
let analyser;
let dataArray;
let canvas;
let canvasContext;
let source;
let isSpectrumActive = false;
let animationId;

document.addEventListener('DOMContentLoaded', () => {
    const audio = document.querySelector('audio');
    const closeButton = document.querySelector('.close-button');
    const bars = document.querySelectorAll('.bar');
    // const statusIndicator = document.querySelector('.status-indicator');
    // const statusText = document.querySelector('.status-text');
    
    // Stream status management
    function updateStreamStatus(status, message) {
        const retryBtn = document.getElementById('retry-btn');
        
        // statusIndicator.className = 'status-indicator ' + status;
        // statusText.textContent = message;
        
        // Show/hide retry button
        if (retryBtn) {
            retryBtn.style.display = status === 'error' ? 'block' : 'none';
        }
    }
    
    // Enhanced retry functionality
    function retryConnection() {
        updateStreamStatus('connecting', 'Tentando reconectar...');
        
        // Force reload of audio sources
        audio.load();
        
        // Try to play after a short delay
        setTimeout(() => {
            audio.play().catch(error => {
                console.log('Retry failed:', error);
                updateStreamStatus('error', 'Falha na reconexão - Tente novamente');
            });
        }, 1000);
    }
    
    // Custom URL functionality
    function addCustomURL(url) {
        if (audio && url) {
            // Validate URL
            try {
                new URL(url);
            } catch {
                alert('URL inválida. Por favor, insira uma URL válida.');
                return;
            }
            
            // Create new source element
            const source = document.createElement('source');
            source.src = url;
            source.type = 'audio/mpeg';
            
            // Insert as first source (highest priority)
            audio.insertBefore(source, audio.firstElementChild);
            
            // Save to localStorage
            const customUrls = JSON.parse(localStorage.getItem('customStreamUrls') || '[]');
            if (!customUrls.includes(url)) {
                customUrls.unshift(url);
                // Keep only last 5 custom URLs
                if (customUrls.length > 5) {
                    customUrls.splice(5);
                }
                localStorage.setItem('customStreamUrls', JSON.stringify(customUrls));
            }
            
            updateStreamStatus('connecting', 'Testando URL personalizada...');
            audio.load();
            
            // Try to play the new URL
            setTimeout(() => {
                audio.play().catch(error => {
                    console.log('Custom URL failed:', error);
                    updateStreamStatus('error', 'URL personalizada falhou');
                });
            }, 1000);
        }
    }
    
    // Load saved custom URLs
    function loadCustomURLs() {
        const customUrls = JSON.parse(localStorage.getItem('customStreamUrls') || '[]');
        
        customUrls.forEach(url => {
            const source = document.createElement('source');
            source.src = url;
            source.type = 'audio/mpeg';
            audio.insertBefore(source, audio.firstElementChild);
        });
    }
    
    // Initialize custom URL modal
    function initCustomURLModal() {
        const modal = document.getElementById('custom-url-modal');
        const btn = document.getElementById('custom-url-btn');
        const closeBtn = document.querySelector('.close');
        const addBtn = document.getElementById('add-custom-url');
        const cancelBtn = document.getElementById('cancel-custom-url');
        const input = document.getElementById('custom-url-input');
        
        if (btn && modal) {
            btn.addEventListener('click', () => {
                modal.style.display = 'block';
                input.focus();
            });
        }
        
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                input.value = '';
            });
        }
        
        if (cancelBtn && modal) {
            cancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                input.value = '';
            });
        }
        
        if (addBtn && modal && input) {
            addBtn.addEventListener('click', () => {
                const url = input.value.trim();
                if (url) {
                    addCustomURL(url);
                    modal.style.display = 'none';
                    input.value = '';
                } else {
                    alert('Por favor, insira uma URL válida.');
                }
            });
        }
        
        // Close modal when clicking outside
        if (modal) {
            window.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                    input.value = '';
                }
            });
        }
        
        // Handle Enter key in input
        if (input) {
            input.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    addBtn.click();
                }
            });
        }
    }
    
    // Initialize retry button
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', retryConnection);
    }
    
    // Initialize custom URL functionality
    initCustomURLModal();
    loadCustomURLs();
    
    // Inicializa o canvas do espectro
    canvas = document.getElementById('spectrum-canvas');
    canvasContext = canvas.getContext('2d');
    
    // Configura o tamanho do canvas
    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Inicializa o Web Audio API
    function initAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 512; // Aumentado para melhor resolução
                analyser.smoothingTimeConstant = 0.8;
                
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                
                // Conecta o elemento de áudio ao analisador
                if (!source) {
                    source = audioContext.createMediaElementSource(audio);
                    source.connect(analyser);
                    analyser.connect(audioContext.destination);
                }
                
                console.log('Web Audio API inicializado com sucesso');
                return true;
            } catch (error) {
                console.log('Web Audio API não suportado:', error);
                return false;
            }
        }
        return true;
    }

    // Inicia o espectro de áudio
    function startSpectrum() {
        if (initAudioContext()) {
            isSpectrumActive = true;
            drawSpectrum();
        } else {
            // Fallback para animação CSS apenas
            startFallbackAnimation();
        }
    }

    // Para o espectro de áudio
    function stopSpectrum() {
        isSpectrumActive = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        // Limpa o canvas
        if (canvasContext) {
            canvasContext.clearRect(0, 0, canvas.width, canvas.height);
        }
        // Reset das barras CSS
        bars.forEach(bar => {
            bar.style.height = '8px';
        });
    }

    // Desenha o espectro no canvas
    function drawSpectrum() {
        if (!isSpectrumActive || !analyser || !dataArray) return;
        
        animationId = requestAnimationFrame(drawSpectrum);
        
        analyser.getByteFrequencyData(dataArray);
        
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = canvas.width / 64; // Usando apenas 64 barras para melhor performance
        let x = 0;
        
        // Desenha as barras do espectro no canvas
        for (let i = 0; i < 64; i++) {
            // Pega uma média de algumas frequências para cada barra
            const start = Math.floor(i * dataArray.length / 64);
            const end = Math.floor((i + 1) * dataArray.length / 64);
            let sum = 0;
            for (let j = start; j < end; j++) {
                sum += dataArray[j];
            }
            const average = sum / (end - start);
            
            const barHeight = (average / 255) * canvas.height * 0.9;
            
            // Gradiente para cada barra
            const gradient = canvasContext.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
            gradient.addColorStop(0, '#FF6B00');
            gradient.addColorStop(0.5, '#ff8533');
            gradient.addColorStop(1, '#ffaa66');
            
            canvasContext.fillStyle = gradient;
            canvasContext.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
            
            x += barWidth;
        }
        
        // Atualiza as barras CSS também
        updateCSSBars();
    }

    // Atualiza as barras CSS com base nos dados de áudio
    function updateCSSBars() {
        if (!dataArray) return;
        
        const step = Math.floor(dataArray.length / bars.length);
        
        bars.forEach((bar, index) => {
            const dataIndex = index * step;
            const value = dataArray[dataIndex] || 0;
            const height = Math.max(8, (value / 255) * 60 + 8);
            bar.style.height = height + 'px';
        });
    }

    // Animação de fallback quando Web Audio API não está disponível
    function startFallbackAnimation() {
        console.log('Usando animação de fallback para o espectro');
        let fallbackInterval;
        
        const animateBars = () => {
            if (!document.body.classList.contains('playing')) {
                clearInterval(fallbackInterval);
                return;
            }
            
            bars.forEach((bar, index) => {
                const randomHeight = Math.random() * 40 + 10;
                bar.style.height = randomHeight + 'px';
            });
        };
        
        fallbackInterval = setInterval(animateBars, 150);
        
        // Limpa o intervalo quando o áudio para
        audio.addEventListener('pause', () => clearInterval(fallbackInterval));
        audio.addEventListener('ended', () => clearInterval(fallbackInterval));
    }

    // Initial status
    updateStreamStatus('', 'Clique em Play para conectar');
    
    // Event listeners para o áudio com tratamento de erros aprimorado
    audio.addEventListener('loadstart', () => {
        updateStreamStatus('connecting', 'Conectando ao stream...');
    });
    
    audio.addEventListener('loadeddata', () => {
        updateStreamStatus('connected', 'Stream carregado');
    });

    audio.addEventListener('canplay', () => {
        updateStreamStatus('connected', 'Pronto para reproduzir');
    });
    
    audio.addEventListener('canplaythrough', () => {
        updateStreamStatus('connected', 'Stream totalmente carregado');
    });

    audio.addEventListener('play', () => {
        document.body.classList.add('playing');
        updateStreamStatus('playing', 'Reproduzindo ao vivo');
        
        // Inicializa o contexto de áudio na primeira interação do usuário
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                startSpectrum();
            });
        } else {
            startSpectrum();
        }
    });

    audio.addEventListener('pause', () => {
        document.body.classList.remove('playing');
        updateStreamStatus('connected', 'Pausado');
        stopSpectrum();
    });

    audio.addEventListener('ended', () => {
        document.body.classList.remove('playing');
        updateStreamStatus('connected', 'Transmissão finalizada');
        stopSpectrum();
    });

    audio.addEventListener('error', (e) => {
        let errorMessage = 'Erro de conexão';
        
        if (audio.error) {
            switch(audio.error.code) {
                case 1: // MEDIA_ERR_ABORTED
                    errorMessage = 'Conexão interrompida';
                    break;
                case 2: // MEDIA_ERR_NETWORK
                    errorMessage = 'Erro de rede - Tentando próximo servidor';
                    break;
                case 3: // MEDIA_ERR_DECODE
                    errorMessage = 'Erro de decodificação - Tentando próximo servidor';
                    break;
                case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                    errorMessage = 'Stream não disponível - Tentando próximo servidor';
                    break;
                default:
                    errorMessage = 'Erro desconhecido - Tentando reconectar';
            }
        }
        
        console.error('Erro no stream de áudio:', e, audio.error);
        updateStreamStatus('error', errorMessage);
        
        // Auto-retry with next source after 2 seconds
        setTimeout(() => {
            console.log('Tentando próximo servidor...');
            tryNextSource();
        }, 2000);
    });

    // Função para tentar próxima fonte de áudio
    function tryNextSource() {
        const sources = audio.querySelectorAll('source');
        let currentIndex = -1;
        
        // Encontra a fonte atual
        for (let i = 0; i < sources.length; i++) {
            if (sources[i].src === audio.currentSrc || sources[i].src === audio.src) {
                currentIndex = i;
                break;
            }
        }
        
        // Tenta próxima fonte
        const nextIndex = (currentIndex + 1) % sources.length;
        if (nextIndex !== currentIndex && sources[nextIndex]) {
            updateStreamStatus('connecting', 'Conectando ao servidor alternativo...');
            audio.src = sources[nextIndex].src;
            audio.load();
            
            // Tenta reproduzir após carregar
            setTimeout(() => {
                audio.play().catch(error => {
                    console.log('Falha ao conectar servidor alternativo:', error);
                    if (nextIndex < sources.length - 1) {
                         tryNextSource();
                     } else {
                         updateStreamStatus('error', 'Todos os servidores indisponíveis');
                         // Mostra botão de retry quando todos os servidores falharem
                         const retryBtn = document.getElementById('retry-btn');
                         if (retryBtn) {
                             retryBtn.style.display = 'inline-block';
                         }
                     }
                });
            }, 1000);
        }
     }

    audio.addEventListener('stalled', () => {
        updateStreamStatus('conectando', 'Conexão instável...');
    });

    audio.addEventListener('waiting', () => {
        updateStreamStatus('conectando', 'Aguardando dados...');
    });
    
    audio.addEventListener('progress', () => {
        if (audio.buffered.length > 0) {
            updateStreamStatus('conectando', 'Stream online...');
        }
    });
    
    // Attempt to preload when user interacts
    // Adiciona botão de retry manual
    function addRetryButton() {
        // const statusContainer = document.querySelector('.status-container');
        let retryBtn = document.getElementById('retry-btn');
        
        if (!retryBtn) {
            retryBtn = document.createElement('button');
            retryBtn.id = 'retry-btn';
            retryBtn.className = 'retry-button';
            retryBtn.textContent = 'Tentar Novamente';
            retryBtn.style.display = 'none';
            
            retryBtn.addEventListener('click', () => {
                updateStreamStatus('connecting', 'Tentando reconectar...');
                retryBtn.style.display = 'none';
                
                // Reset para primeira fonte
                const sources = audio.querySelectorAll('source');
                if (sources.length > 0) {
                    audio.src = sources[0].src;
                    audio.load();
                    audio.play().catch(() => {
                        tryNextSource();
                    });
                }
            });
            
            // statusContainer.appendChild(retryBtn);
            // Como o status-container foi removido, adiciona o botão ao main
            const main = document.querySelector('main');
            if (main) {
                main.insertBefore(retryBtn, main.firstChild);
            }
        }
        
        return retryBtn;
    }

    // Inicializa botão de retry
    addRetryButton();
    
    // Attempt to preload when user interacts
    audio.addEventListener('click', () => {
        if (audio.readyState === 0) {
            updateStreamStatus('conectando', 'Stream online...');
            audio.load();
        }
    });

    // Adiciona efeito de hover no botão de fechar
    closeButton.addEventListener('mouseenter', () => {
        closeButton.style.transform = 'translateY(-2px)';
    });

    closeButton.addEventListener('mouseleave', () => {
        closeButton.style.transform = 'translateY(0)';
    });

    // Salva o estado do player quando a página é fechada
    window.addEventListener('beforeunload', () => {
        localStorage.setItem('radioVolume', audio.volume);
        localStorage.setItem('radioMuted', audio.muted);
    });

    // Restaura o estado do player quando a página é carregada
    if (localStorage.getItem('radioVolume')) {
        audio.volume = parseFloat(localStorage.getItem('radioVolume'));
    }
    if (localStorage.getItem('radioMuted')) {
        audio.muted = localStorage.getItem('radioMuted') === 'true';
    }

    // Inicializa a animação de fallback imediatamente
    startFallbackAnimation();
    
    // Força o carregamento do stream
    audio.load();
});
