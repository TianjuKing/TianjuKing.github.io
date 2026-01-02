// 输入为空提示（文案更温和）
function showAlert() {
    const alertDiv = document.getElementById('top-alert');
    alertDiv.style.display = 'block';
    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 2000);
}

document.addEventListener('DOMContentLoaded', () => {

    const isWeChat = navigator.userAgent.toLowerCase().indexOf('micromessenger') !== -1;
    if (isWeChat) {
        // 微信中特殊处理：重新设置viewport
        const metaViewport = document.querySelector('meta[name="viewport"]');
        
        // 确保initial-scale=1.0且禁用缩放(防止微信自动放大)
        metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, shrink-to-fit=no, user-scalable=no');
        
        // 修复微信中输入框聚焦后页面放大问题
        document.querySelectorAll('input, textarea').forEach((el) => {
            el.addEventListener('focus', () => {
                window.scrollTo(0, 0); // 输入框聚焦时强制页面顶部对齐
            });
        });
    }

    const API_BASE_URL = 'http://10.102.33.100:8080';
    const resultContainer = document.getElementById('result-container');
    const outputSection = document.querySelector('.output-section'); 
    const historyList = document.getElementById('history-list');
    const newChatButton = document.getElementById('new-chat-btn');
    const contextMenu = document.createElement('div');
    contextMenu.id = 'history-context-menu';
    contextMenu.className = 'history-context-menu';
    contextMenu.innerHTML = `
        <button type="button" class="context-menu-item" data-action="delete">删除对话</button>
    `;
    document.body.appendChild(contextMenu);
    const loadingIndicator = document.createElement('div');
    loadingIndicator.classList.add('loading-indicator');
    loadingIndicator.textContent = '正在倾听你的心声...'; // 贴合心理场景的加载文案

    const userInput = document.getElementById('user-input');
    const submitButton = document.getElementById('submit-button');
    
    let activeSessionId = null;
    let conversations = [];
    let currentConversationIndex = -1;
    let isProcessing = false;
    let processingMessage = null;
    let isCreatingSession = false;
    let contextMenuSessionId = null;

    // 处理中提示（更具共情性）
    function showProcessingMessage() {
        if (!processingMessage) {
            processingMessage = document.createElement('div');
            processingMessage.className = 'processing-message';
            processingMessage.textContent = '正在为你梳理思路，请稍候...';
            document.body.appendChild(processingMessage);
        }
    }

    function hideProcessingMessage() {
        if (processingMessage) {
            processingMessage.remove();
            processingMessage = null;
        }
    }

    // 自动滚动到最新内容
    function scrollToBottom(){
        requestAnimationFrame(() => {
            outputSection.scrollTop = outputSection.scrollHeight;
        });
    }

    function formatMessageContent(text = '') {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    function renderWelcomeMessage() {
        resultContainer.innerHTML = `
            <div class="message ai-message">
                <div class="message-icon">
                    <img src="./player.png" alt="AI助手" class="ai-avatar">
                </div>
                <div class="message-content">
                    你好！我是愈小智，你的心理健康助手。有什么我可以帮助你的吗？
                </div>
            </div>
        `;
    }

    function renderMessagesFromHistory(history = [], errorText = '') {
        if (errorText) {
            resultContainer.innerHTML = `
                <div class="message ai-message">
                    <div class="message-icon">
                        <img src="./player.png" alt="AI助手" class="ai-avatar">
                    </div>
                    <div class="message-content">
                        ${errorText}
                    </div>
                </div>
            `;
            return;
        }
        resultContainer.innerHTML = '';
        if (!history.length) {
            renderWelcomeMessage();
            return;
        }

        history.forEach(msg => {
            const formatted = formatMessageContent(msg.content || '');
            if (msg.role === 'user') {
                const userMessageHtml = `
                    <div class="message user-message">
                        <div class="message-content">
                            ${formatted}
                        </div>
                    </div>
                `;
                resultContainer.insertAdjacentHTML('beforeend', userMessageHtml);
            } else if (msg.role === 'assistant') {
                const aiMessage = document.createElement('div');
                aiMessage.className = 'message ai-message';
                aiMessage.innerHTML = `
                    <div class="message-icon">
                        <img src="./player.png" alt="AI助手" class="ai-avatar">
                    </div>
                    <div class="message-content">
                        ${formatted}
                    </div>
                `;
                resultContainer.appendChild(aiMessage);
            }
        });
        scrollToBottom();
    }

    function buildConversationTitle(conversation, index) {
        const summary = (conversation.summary || '').trim();
        if (!summary) {
            return `对话 ${index + 1}`;
        }
        return summary.length > 18 ? `${summary.slice(0, 18)}...` : summary;
    }

    function refreshHistoryList() {
        historyList.innerHTML = '';
        conversations.forEach((conversation, index) => {
            const li = document.createElement('li');
            li.className = `history-item ${conversation.session_id === activeSessionId ? 'active' : ''}`;
            li.dataset.sessionId = conversation.session_id;

            const icon = document.createElement('i');
            icon.className = 'fas fa-comments';
            const span = document.createElement('span');
            span.className = 'history-name';
            span.textContent = buildConversationTitle(conversation, index);
            if (conversation.summary) {
                span.title = conversation.summary;
            } else {
                span.removeAttribute('title');
            }

            li.appendChild(icon);
            li.appendChild(span);

            li.addEventListener('click', () => {
                if (conversation.session_id === activeSessionId) return;
                setActiveSession(conversation.session_id);
                refreshHistoryList();
                loadConversationHistory(conversation.session_id);
            });

            historyList.appendChild(li);
        });
    }

    function setActiveSession(sessionId) {
        const newIndex = conversations.findIndex(conv => conv.session_id === sessionId);
        if (newIndex === -1) {
            currentConversationIndex = -1;
            activeSessionId = null;
            return false;
        }
        currentConversationIndex = newIndex;
        activeSessionId = sessionId;
        return true;
    }

    async function loadConversationHistory(sessionId) {
        if (!sessionId) {
            renderWelcomeMessage();
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations/${sessionId}`);
            if (!response.ok) {
                throw new Error('加载历史失败');
            }
            const data = await response.json();
            if (data.success) {
                renderMessagesFromHistory(data.history || []);
                if (currentConversationIndex !== -1) {
                    conversations[currentConversationIndex].message_count = data.history ? data.history.length : 0;
                    conversations[currentConversationIndex].last_message_preview = data.history && data.history.length
                        ? data.history[data.history.length - 1].content || ''
                        : '';
                    refreshHistoryList();
                }
            } else {
                renderMessagesFromHistory([], '暂未找到该对话的历史内容~');
            }
        } catch (error) {
            console.error('加载会话失败', error);
            renderMessagesFromHistory([], '加载历史对话失败，请稍后再试。');
        }
    }

    async function fetchConversationSummaries() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations`);
            if (!response.ok) {
                throw new Error('加载会话列表失败');
            }
            const data = await response.json();
            if (data.success && Array.isArray(data.conversations)) {
                return data.conversations;
            }
        } catch (error) {
            console.error('获取会话列表异常', error);
        }
        return [];
    }

    async function createNewChat() {
        if (isCreatingSession) return;
        isCreatingSession = true;
        submitButton.disabled = true;
        userInput.disabled = true;
        newChatButton.disabled = true;
        try {
            const response = await fetch(`${API_BASE_URL}/api/get_session`);
            if (!response.ok) {
                throw new Error('创建会话失败');
            }
            const data = await response.json();
            if (data.success) {
                await refreshConversationsFromServer(data.session_id);
                renderWelcomeMessage();
            } else {
                throw new Error('创建会话失败');
            }
        } catch (error) {
            console.error('新建对话失败', error);
            showAlert();
        } finally {
            isCreatingSession = false;
            submitButton.disabled = false;
            userInput.disabled = false;
            newChatButton.disabled = false;
        }
    }

    function hideContextMenu() {
        contextMenu.style.display = 'none';
        contextMenuSessionId = null;
    }

    function showContextMenu(x, y, sessionId) {
        const menuWidth = 140;
        const menuHeight = 48;
        const adjustedX = Math.min(x, window.innerWidth - menuWidth - 8);
        const adjustedY = Math.min(y, window.innerHeight - menuHeight - 8);
        contextMenu.style.left = `${adjustedX}px`;
        contextMenu.style.top = `${adjustedY}px`;
        contextMenu.style.display = 'block';
        contextMenuSessionId = sessionId;
    }

    async function deleteConversation(sessionId) {
        hideContextMenu();
        if (!sessionId) return;
        const confirmed = window.confirm('确定删除该对话吗？删除后无法恢复。');
        if (!confirmed) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations/${sessionId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || '删除失败');
            }
            const deletedActive = sessionId === activeSessionId;
            await refreshConversationsFromServer(deletedActive ? null : activeSessionId);
            if (!conversations.length) {
                activeSessionId = null;
                currentConversationIndex = -1;
                renderWelcomeMessage();
                return;
            }
            if (deletedActive && activeSessionId) {
                await loadConversationHistory(activeSessionId);
            }
        } catch (error) {
            console.error('删除对话失败', error);
            renderMessagesFromHistory([], '删除对话失败，请稍后再试。');
        }
    }

    async function refreshConversationsFromServer(preferredSessionId = null) {
        const latest = await fetchConversationSummaries();
        conversations = latest;
        if (!conversations.length) {
            activeSessionId = null;
            currentConversationIndex = -1;
            refreshHistoryList();
            return;
        }
        const targetId = preferredSessionId || activeSessionId || conversations[0].session_id;
        if (!setActiveSession(targetId)) {
            setActiveSession(conversations[0].session_id);
        }
        refreshHistoryList();
    }

    async function initializeConversations() {
        await refreshConversationsFromServer();
        if (!conversations.length) {
            await createNewChat();
            return;
        }
        await loadConversationHistory(activeSessionId);
    }
    
    async function handleUserInput(event){
        event.preventDefault();
        const inputValue = userInput.value.trim();
        userInput.value = '';


        if (isCreatingSession) {
            showProcessingMessage();
            return;
        }

        if (!activeSessionId) {
            showAlert(); // 可修改alert文案为“请稍候，正在初始化会话...”
            return;
        }

        if (!inputValue) {
            showAlert();
            return;
        }

        // 禁用输入防止重复提交
        submitButton.disabled = true;
        userInput.disabled = true;
        if (isProcessing) {
            showProcessingMessage();
            return;
        }
        isProcessing = true;
        const errorMessage = "暂时无法连接，请稍后再试，我们一直都在"; // 错误文案更具安抚性

        try {
            resultContainer.appendChild(loadingIndicator);
            loadingIndicator.style.display = 'block';
            scrollToBottom(); 

            // 发送请求到后端（替换为你的后端API地址）
            const response = await fetch(`${API_BASE_URL}/api/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    question: inputValue,
                    session_id: activeSessionId  // 新增这一行
                })
            });

            if (!response.ok) {
                throw new Error('服务器响应异常');
            }

            const result = await response.json();
            loadingIndicator.style.display = 'none';

            // 展示用户输入（替换为心理场景的图标）
            const userQuestion = formatMessageContent(inputValue);
            // 新增：用户消息气泡（直接复制粘贴）
            const userMessageHtml = `
                <div class="message user-message">
                    <div class="message-content">
                        ${userQuestion}
                    </div>
                </div>
            `;
            resultContainer.insertAdjacentHTML('beforeend', userMessageHtml);
            /*
            const userIcon = '<img src="./user_1.png" alt="你的提问" class="user_icon">';
            resultContainer.insertAdjacentHTML('beforeend',
                `${userIcon}<strong>我的倾诉:</strong> ${userQuestion}<br>`);*/
            scrollToBottom();
            
            // 展示AI回答（使用心理顾问风格的图标）
            //const advisorIcon = '<img src="./player.png" alt="顾问回复" class="user_icon">';
            // 新增：AI消息气泡容器（直接复制粘贴）
            const aiMessageWrapper = document.createElement('div');
            aiMessageWrapper.className = 'message ai-message';
            aiMessageWrapper.innerHTML = `
                <div class="message-icon">
                    <img src="./player.png" alt="AI助手" class="ai-avatar">
                </div>
                <div class="message-content">
                    <span class="ai-answer"></span> <!-- 打字机效果写在这里 -->
                </div>
            `;
            resultContainer.appendChild(aiMessageWrapper);
            // 新增：指定打字机效果的目标容器
            const aiAnswerContainer = aiMessageWrapper.querySelector('.ai-answer');
            const answerContent = formatMessageContent(result.answer || '');
            //resultContainer.insertAdjacentHTML('beforeend',
                //`<strong>${advisorIcon}心理支持:</strong>`);
            scrollToBottom(); 

            // 打字机效果（保持逐字显示的温暖感）
            const typingEffect = async (text, container) => {
                return new Promise((resolve) => {
                    let index = 0;
                    const typingInterval = 40; // 稍慢的速度，更显耐心
                    let currentNode = null;

                    const typeTextCharByChar = () => {
                        if (index >= text.length) {
                            scrollToBottom();
                            resolve();
                            return;
                        }
                        const char = text.charAt(index);
                        if (char === '<') {
                            let endIndex = text.indexOf('>', index);
                            if (endIndex !== -1) {
                                const tag = text.substring(index, endIndex + 1);
                                container.insertAdjacentHTML('beforeend', tag);
                                index = endIndex + 1;
                                currentNode = container.lastChild;
                                scrollToBottom();
                                setTimeout(typeTextCharByChar, typingInterval);
                                return;
                            }
                        } else if (currentNode && currentNode.nodeName === '#text') {
                            currentNode.nodeValue += char;
                        } else {
                            currentNode = document.createTextNode(char);
                            container.appendChild(currentNode);
                        }
                        index++;
                        setTimeout(typeTextCharByChar, typingInterval);
                        scrollToBottom();
                    };
                    typeTextCharByChar();
                });
            };

            // 完成后恢复输入状态
            typingEffect(answerContent, aiAnswerContainer).then(() => {
                //resultContainer.insertAdjacentHTML('beforeend',`<br><br>`);
                scrollToBottom(); 
                submitButton.disabled = false;
                userInput.disabled = false;
                isProcessing = false;
                hideProcessingMessage();
                userInput.focus(); 
                refreshConversationsFromServer(activeSessionId).catch(err => console.error('刷新会话列表失败', err));
            })

        } catch (error) {
            // 错误处理（保持界面可用）
            userInput.value = '';
            submitButton.disabled = false;
            userInput.disabled = false;
            isProcessing = false;
            loadingIndicator.style.display = 'none';
            // 新增：错误消息气泡（直接复制粘贴）
            const errorMessageHtml = `
                <div class="message ai-message">
                    <div class="message-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="message-content">
                        <strong>提示:</strong> ${errorMessage}
                    </div>
                </div>
            `;
            resultContainer.insertAdjacentHTML('beforeend', errorMessageHtml);
            //const errorIcon = '<img src="./player.png" alt="提示" class="icon">';
            //resultContainer.insertAdjacentHTML('beforeend',
                //`<strong>${errorIcon}提示:</strong> ${errorMessage}<br><br>`);
        }
    }

    // 绑定提交事件（点击按钮或按Enter）
    submitButton.addEventListener('click', (event) => {
        if (activeSessionId) handleUserInput(event);
        else showAlert(); // 提示“会话初始化中，请稍候”
    });
    
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && activeSessionId) {
            handleUserInput(event);
        }
    });

    // 绑定新建对话按钮事件
    newChatButton.addEventListener('click', () => {
        createNewChat();
    });

    historyList.addEventListener('contextmenu', (event) => {
        const item = event.target.closest('.history-item');
        if (!item) return;
        event.preventDefault();
        showContextMenu(event.pageX, event.pageY, item.dataset.sessionId);
    });

    contextMenu.addEventListener('click', (event) => {
        const action = event.target.dataset.action;
        if (!action) return;
        if (action === 'delete' && contextMenuSessionId) {
            deleteConversation(contextMenuSessionId);
        }
    });

    document.addEventListener('click', (event) => {
        if (event.target.closest('#history-context-menu')) return;
        hideContextMenu();
    });

    window.addEventListener('resize', hideContextMenu);
    window.addEventListener('scroll', hideContextMenu, true);

    initializeConversations().catch(err => {
        console.error('初始化会话失败', err);
        renderMessagesFromHistory([], '会话初始化失败，请检查网络或稍后再试。');
    });


});


// 侧边栏收起/展开功能
const sidebar = document.querySelector('.sidebar');
const toggleBtn = document.querySelector('.toggle-sidebar-btn');

// 点击按钮切换收起/展开状态
toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    // 记忆状态（刷新后不恢复）
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
});

// 页面加载时恢复上次状态
window.addEventListener('load', () => {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    }
});
// 语音模式相关功能
document.addEventListener('DOMContentLoaded', () => {
    const voiceToggleBtn = document.getElementById('voice-toggle-btn');
    const backToTextBtn = document.getElementById('back-to-text-btn');
    const voiceModeContainer = document.getElementById('voice-mode-container');
    const outputSection = document.querySelector('.output-section');
    const inputContainer = document.querySelector('.input-container');
    const voiceAvatar = document.getElementById('voice-avatar');
    const audioVisualizer = document.getElementById('audio-visualizer');
    const audioBars = audioVisualizer.querySelectorAll('.audio-bar');
    const audioStatusText = document.getElementById('audio-status-text');

    let isRecording = false;
    let isListening = false;
    let visualizerInterval;

    // 切换到语音模式
    voiceToggleBtn.addEventListener('click', () => {
        outputSection.style.display = 'none';
        inputContainer.style.display = 'none';
        voiceModeContainer.style.display = 'flex';
        stopAllAnimations(); // 初始状态保持静止
    });

    // 切换回文字模式
    backToTextBtn.addEventListener('click', () => {
        // 隐藏语音模式元素
        voiceModeContainer.style.display = 'none';
        // 显示文字模式元素
        outputSection.style.display = 'block';
        inputContainer.style.display = 'flex';
        stopAllAnimations();
    });

    // 长按头像录音功能
    voiceAvatar.addEventListener('mousedown', startRecording);
    voiceAvatar.addEventListener('touchstart', startRecording, { passive: true });

    voiceAvatar.addEventListener('mouseup', stopRecording);
    voiceAvatar.addEventListener('mouseleave', stopRecording);
    voiceAvatar.addEventListener('touchend', stopRecording);

    // 开始录音
    function startRecording() {
        isRecording = true;
        isListening = false;
        stopAllAnimations();
        voiceAvatar.classList.add('recording');
        voiceAvatar.classList.remove('listening');

        // 模拟录音时的波形动画
        startVisualizerAnimation(50, 100);

        // 这里可以添加实际录音逻辑
        console.log('开始录音...');
    }

    function stopRecording() {
        if (!isRecording) return;
        isRecording = false;
        voiceAvatar.classList.remove('recording');

        showStatusText(true);
        stopVisualizerAnimation();

        setTimeout(() => {
            showStatusText(false);
            startListeningAnimation();
            setTimeout(() => {
                startVisualizerAnimation(30, 80);
                setTimeout(() => {
                    stopAllAnimations();
                }, 5000);
            }, 1000);
        }, 2000);
    }

    // 开始倾听动画
    function startListeningAnimation() {
        isListening = true;
        voiceAvatar.classList.add('listening');
        startVisualizerAnimation(10, 40);
    }

    // 音频可视化动画
    function startVisualizerAnimation(minHeight, maxHeight) {
        showStatusText(false);
        stopVisualizerAnimation();
        visualizerInterval = setInterval(() => {
            audioBars.forEach((bar) => {
                const height = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
                bar.style.height = `${height}%`;
            });
        }, 80);
    }

    function stopVisualizerAnimation() {
        clearInterval(visualizerInterval);
    }

    // 停止所有动画
    function stopAllAnimations() {
        stopVisualizerAnimation();
        audioBars.forEach(bar => {
            bar.style.height = '20%';
        });
        voiceAvatar.classList.remove('recording', 'listening');
        showStatusText(false);
    }

    function showStatusText(visible) {
        if (!audioStatusText) return;
        audioStatusText.style.display = visible ? 'block' : 'none';
    }
});

// 页面加载完成后，给语音头像加防护
document.addEventListener('DOMContentLoaded', function() {
  const voiceAvatar = document.querySelector('.voice-avatar');
  if (voiceAvatar) {
    voiceAvatar.setAttribute('tabindex', '-1');
    voiceAvatar.blur();
    voiceAvatar.addEventListener('click', (e) => {
      e.preventDefault();
    });
    voiceAvatar.addEventListener('touchstart', (e) => {
      e.preventDefault();
    });
  }
});
