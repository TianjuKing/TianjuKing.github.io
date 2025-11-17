// 输入为空提示（文案更温和）
function showAlert() {
    const alertDiv = document.getElementById('top-alert');
    alertDiv.style.display = 'block';
    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 2000);
}

document.addEventListener('DOMContentLoaded', () => {
    const resultContainer = document.getElementById('result-container');
    const outputSection = document.querySelector('.output-section'); 
    const loadingIndicator = document.createElement('div');
    loadingIndicator.classList.add('loading-indicator');
    loadingIndicator.textContent = '正在倾听你的心声...'; // 贴合心理场景的加载文案

    const userInput = document.getElementById('user-input');
    const submitButton = document.getElementById('submit-button');
    
    let isProcessing = false;
    let processingMessage = null;

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
    
    async function handleUserInput(event){
        event.preventDefault();
        const inputValue = userInput.value.trim();
        userInput.value = '';

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
            const response = await fetch('http://10.102.33.100:8080/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: inputValue })
            });

            if (!response.ok) {
                throw new Error('服务器响应异常');
            }

            const result = await response.json();
            loadingIndicator.style.display = 'none';

            // 展示用户输入（替换为心理场景的图标）
            const userQuestion = inputValue.replace(/\n/g,'<br>');
            const userIcon = '<img src="./user_1.png" alt="你的提问" class="icon">';
            resultContainer.insertAdjacentHTML('beforeend', 
                `${userIcon}<strong>我的倾诉:</strong> ${userQuestion}<br>`);
            scrollToBottom();
            
            // 展示AI回答（使用心理顾问风格的图标）
            const advisorIcon = '<img src="./player.png" alt="顾问回复" class="icon">';
            
            const answerContent = result.answer
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // 处理***加粗***
                .replace(/\n/g, '<br>'); // 保持换行处理    
            resultContainer.insertAdjacentHTML('beforeend', 
                `<strong>${advisorIcon}心理支持:</strong>`);
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
            typingEffect(answerContent, resultContainer).then(() => {
                resultContainer.insertAdjacentHTML('beforeend',`<br><br>`);
                scrollToBottom(); 
                submitButton.disabled = false;
                userInput.disabled = false;
                isProcessing = false;
                hideProcessingMessage();
                userInput.focus(); 
            })

        } catch (error) {
            // 错误处理（保持界面可用）
            userInput.value = '';
            submitButton.disabled = false;
            userInput.disabled = false;
            isProcessing = false;
            loadingIndicator.style.display = 'none';
            const errorIcon = '<img src="./player.png" alt="提示" class="icon">';
            resultContainer.insertAdjacentHTML('beforeend',
                `<strong>${errorIcon}提示:</strong> ${errorMessage}<br><br>`);
        }
    }

    // 绑定提交事件（点击按钮或按Enter）
    submitButton.addEventListener('click', handleUserInput);
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            handleUserInput(event);
        }
    });
});