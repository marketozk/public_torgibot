// ==UserScript==
// @name         TorgiBot.site Helper
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Добавляет виджет на страницу офферты РТС/ОТС
// @author       Nikolai S.
// @match        https://market.rts-tender.ru/zapros/ *
// @match        *://market.rts-tender.ru/my/deal/sales/details*
// @match        *://omskregion.rts-tender.ru/my/deal/sales/details*
// @match        *://market.rts-tender.ru/zapros/*
// @match        *://omskregion.rts-tender.ru/zapros/*
// @match        *.rts-tender.ru/my/deal/sales/details*
// @match        *.rts-tender.ru/search/sell*
// @match        *.rts-tender.ru/zapros/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addValueChangeListener
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    GM_deleteValue('tenantId');

    GM_addStyle(`
        #airtable-widget {
            position: fixed;
            top: 15px;
            right: 15px;
            z-index: 9999;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            width: 400px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            padding-bottom: 12px;
        }
        #airtable-header {
            padding: 12px;
            background: #f5f5f5;
            border-radius: 8px 8px 0 0;
            cursor: move;
            user-select: none;
            border-bottom: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        #airtable-close {
            cursor: pointer;
            padding: 0 5px;
            font-size: 18px;
            color: #666;
        }
        #airtable-close:hover {
            color: #f44336;
        }
        #airtable-header > span:first-of-type {
            flex-grow: 1;
            margin-right: 10px;
        }
        #trade-id-hint {
             display: none;
             padding: 12px;
             background: #fff9c4;
             border-bottom: 1px solid #ddd;
             font-size: 14px;
             text-align: center;
             font-weight: 600;
             margin-bottom: 12px;
         }
        .airtable-embed {
            border: none !important;
        }
        #airtable-spoiler {
            width: 100%;
            overflow: hidden;
            padding: 0;
            height: 0;
            position: relative;
            transition: height 0.3s;
            margin-bottom: 12px;
        }
        #airtable-iframe-wrap {
            display: none;
            width: 100%;
            height: 100%;
            position: relative;
            overflow-y: auto;
            overflow-x: hidden;
        }
        #airtable-iframe-wrap iframe {
            width: 100%;
            height: 60vh;
            min-height: 400px;
            max-height: 65vh;
            border: 1px solid #ddd;
            background: transparent;
            display: block;
            transform: none !important;
            overflow-x: hidden;
        }
        #airtable-params {
            display: none;
            padding: 12px;
            background: #f9f9f9;
            border-top: 1px solid #ddd;
            position: relative;
        }
        #airtable-buttons, #airtable-buttons2 {
            display: flex;
            gap: 8px;
            justify-content: center;
            margin: 0;
            margin-bottom: 12px;
            padding: 0 12px;
        }
        #airtable-buttons button,
        #airtable-buttons2 button {
            flex: 1;
            padding: 8px 0;
            border-radius: 6px;
            border: 1px solid #ddd;
            color: #fff;
            cursor: pointer;
            transition: background-color 0.2s ease, opacity 0.2s ease;
        }
        #airtable-toggle-btn { background-color: #d2412a; }
        #airtable-max-btn { background-color: #e1762f; }
        #restoreInitBtn { background-color: #f2db51; }
        #restore-stop-prices-btn { background-color: #63d2cf; }
        #airtable-buttons2 button:nth-child(1) { background-color: #b1d543; }
        #airtable-buttons2 button:nth-child(3) { background-color: #b05dc5; }
        #airtable-buttons button:hover,
        #airtable-buttons2 button:hover {
            opacity: 0.9;
        }
    `);

    (function injectBearerSniffer() {
        const injectedCode = String.raw`(() => {
            if (window.__RTS_SNIFFER_INJECTED__) return;
            window.__RTS_SNIFFER_INJECTED__ = true;

            const POST = (k, v) => window.postMessage({ __RTS_META__: { k, v } }, '*');

            const shorten = (token) => {
                if (!token || typeof token !== 'string' || token.length < 15) return token;
                const tokenPart = token.startsWith('Bearer ') ? token.substring(7) : token;
                if (tokenPart.length < 15) return token;
                return tokenPart.substring(0, 5) + '...' + tokenPart.substring(tokenPart.length - 5);
            };

            const ofetch = window.fetch;
            window.fetch = function (resource, init = {}) {
                const requestUrl = (resource instanceof Request) ? resource.url : String(resource);
                try {
                    const headers = init.headers || {};
                    const scan = h => {
                        const b = h.get ? (h.get('Authorization') || h.get('authorization')) : (h.Authorization || h.authorization);
                        const t = h.get ? (h.get('XXX-TenantId-Header') || h.get('xxx-tenantid-header')) : (h['XXX-TenantId-Header'] || h['xxx-tenantid-header']);
                        if (b) POST('bearerToken', b);
                        if (t) POST('tenantId', String(t));
                    };
                    scan(headers);
                    if (resource instanceof Request) scan(resource.headers);
                } catch (e) {}
                return ofetch.apply(this, arguments);
            };

            const oset = XMLHttpRequest.prototype.setRequestHeader;
            XMLHttpRequest.prototype.setRequestHeader = function (n, v) {
                try {
                    const low = n.toLowerCase();
                    if (low === 'authorization') POST('bearerToken', v);
                    if (low === 'xxx-tenantid-header') POST('tenantId', String(v));
                } catch (e) {}
                return oset.apply(this, arguments);
            };
        })();`;

        const s = document.createElement('script');
        s.textContent = injectedCode;
        try {
            new Function(injectedCode);
        } catch (e) {
            console.error('PARSE FAIL inside injectedCode:', e);
            console.log('----------- injectedCode -----------\n' + injectedCode);
            throw e;
        }
        (document.head || document.documentElement).appendChild(s);
        setTimeout(() => s.remove(), 300);
    })();

    function shortenToken(token) {
        if (!token || typeof token !== 'string' || token.length < 15) return token;
        const tokenPart = token.startsWith('Bearer ') ? token.substring(7) : token;
        if (tokenPart.length < 15) return token;
        return tokenPart.substring(0, 5) + '...' + tokenPart.substring(tokenPart.length - 5);
    }

    const widget = document.createElement('div');
    widget.id = 'airtable-widget';
    widget.innerHTML = `
        <div id="airtable-header">
            <span>🤖RTS TorgiBot</span>
            <span id="airtable-close">×</span>
        </div>
        <div id="trade-id-hint" style="display:none;"></div>
        <div id="airtable-spoiler">
            <div id="airtable-iframe-wrap">
                <iframe
                    src="about:blank"
                    style="background: transparent; width:100%; height:60vh; min-height:400px; max-height:65vh; display:block;"
                    width="100%"
                    height="400"
                    frameborder="0"
                    allowfullscreen
                    loading="lazy"
                    class="airtable-embed">
                </iframe>
            </div>
            <div id="airtable-params" style="display:none;">
                <div>Начальная сумма: <span id="initial-sum" style="font-weight: bold;">N/A</span></div>
                <div>Стоп-цена: <span id="stop-sum" style="font-weight: bold;">N/A</span></div>
                <div>Фактическая цена (после выравнивания): <span id="actual-sum" style="font-weight: bold;">N/A</span></div>
            </div>
        </div>
        <div id="airtable-buttons">
            <button id="airtable-toggle-btn" type="button">Зарядить закупку в робота</button>
            <button id="airtable-max-btn" type="button">Выровнять цены по максимуму</button>
            <button id="restoreInitBtn" type="button">Восстановить начальные цены</button>
        </div>
        <div id="airtable-buttons2">
            <button type="button">Проставить страну</button>
            <button id="restore-stop-prices-btn" type="button">Восстановить стоп цены</button>
            <button type="button">Оставить обращение</button>
        </div>
    `;

    function getTradeId() {
        const a = document.querySelector('#crumb1[href^="/zapros/"]');
        const id1 = a?.getAttribute('href')?.match(/\d+/)?.[0];
        if (id1) return id1;
        const span = Array.from(document.querySelectorAll('span')).find(el => /Заказ\s*№\s*\d+/.test(el.textContent));
        const id2 = span?.textContent.match(/\d+/)?.[0];
        return id2 || null;
    }

    function getInitialAmount() {
        const clean = str => parseFloat(str.replace(/[^\d,\.]/g, '').replace(',', '.')) || 0;
        let sum = 0;
        const entries = document.querySelector('app-deal-application-entries');
        if (entries) {
            const row = Array.from(entries.querySelectorAll('div[rts-at="dealApplicationTruEntryRow"]')).find(div => /начальная сумма цен единиц ТРУ/i.test(div.textContent));
            if (row) {
                const span = row.querySelector('span');
                if (span) sum = clean(span.textContent);
            }
        }
        if (sum === 0) {
            document.querySelectorAll('div.deal-application-tru-entries__row').forEach(row => {
                const label = row.querySelector('span');
                if (label && /начальная сумма цен единиц тру/i.test(label.textContent)) {
                    const val = label.nextElementSibling;
                    if (val && val.tagName === 'SPAN') sum = clean(val.textContent);
                }
            });
        }
        if (sum === 0) {
            const key = Array.from(document.querySelectorAll('span.entries__key')).find(sp => /общая сумма/i.test(sp.textContent));
            if (key && key.nextElementSibling && key.nextElementSibling.tagName === 'SPAN') sum = clean(key.nextElementSibling.textContent);
        }
        if (sum === 0) {
            const last = document.querySelector('[formarrayname="Products"] li.item:last-child .item__sum__double-width');
            if (last) sum = clean(last.textContent);
        }
        return sum;
    }

    let savedStopPrices = null;

    function cleanNumber(str) {
        if (!str) return 0;
        return parseFloat(String(str).replace(/\s|\u00A0/g, '').replace(',', '.')) || 0;
    }

    function formatCurrency(price) {
        if (typeof price !== 'number' || isNaN(price)) return 'N/A';
        return price.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
    }

    function scrapePositions() {
        const positions = [];
        try {
            const listContainer = document.querySelector('app-deal-application-positions-old');
            if (!listContainer) return [];
            const list = listContainer.querySelector('ul[formarrayname="Products"]');
            if (!list) return [];
            const items = Array.from(list.querySelectorAll(':scope > li.item:not(:last-child)'));
            if (!items.length) return [];
            items.forEach((item, index) => {
                const nameElement = item.querySelector('.product-name h3');
                const name = nameElement ? nameElement.textContent?.trim() : `Позиция ${index + 1}`;
                const priceInput = item.querySelector('.item__price rts-input-number input[type="text"]');
                let price = 0;
                if (priceInput) {
                    price = cleanNumber(priceInput.value);
                } else {
                    const priceTextSelectors = [
                        '.item__price rts-input-number tui-value-decoration span.t-text',
                        '.item__price rts-input-number tui-value-decoration span.t-ghost',
                        '.item__price rts-input-number span'
                    ];
                    for (const selector of priceTextSelectors) {
                        const priceTextElement = item.querySelector(selector);
                        if (priceTextElement) {
                            price = cleanNumber(priceTextElement.textContent);
                            if (price > 0) break;
                        }
                    }
                }
                const qtyElement = item.querySelector('span.item__quantity');
                let quantity = 1;
                if (qtyElement) quantity = cleanNumber(qtyElement.textContent);
                if (!quantity || quantity <= 0) quantity = 1;
                positions.push({ Name: name, Price: price, Quantity: quantity, inputElement: priceInput, itemElement: item });
            });
        } catch (err) {}
        return positions;
    }

    function calculateSum(positions) {
        return positions.reduce((sum, p) => sum + p.Price * p.Quantity, 0);
    }

    function setPricesOnPage(list) {
        const items = Array.from(document.querySelectorAll('app-deal-application-positions-old li.item:not(:last-child)'));
        let ok = 0, fail = 0;
        list.forEach((p, i) => {
            const li = items[i];
            if (!li) return;
            const input = li.querySelector('rts-input-number input');
            if (!input) return;
            try {
                const setVal = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                const priceStr = p.newPrice.toFixed(2).replace('.', ',');
                setVal.call(input, priceStr);
                ['input', 'change', 'blur'].forEach(ev => input.dispatchEvent(new Event(ev, { bubbles: true })));
                ok++;
            } catch (e) {
                fail++;
            }
        });
    }

    function getCurrentBearerToken() {
        return GM_getValue('bearerToken', null);
    }

    async function ensureTenantId() {
        let tenantId = GM_getValue('tenantId', null);
        const bearer = getCurrentBearerToken();
        if (!bearer) throw new Error('токен не доступен для получения TenantId');
        const resp = await fetch('https://zmo-new-webapi.rts-tender.ru/market/api/v1/tenants ', {
            method: 'POST',
            headers: {
                'Authorization': bearer,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                SearchUrl: 'https://market.rts-tender.ru ',
                Protocol: 'https',
                Preview: false
            })
        });
        if (!resp.ok) throw new Error('Ошибка сети при запросе TenantId: HTTP ' + resp.status);
        const data = await resp.json();
        const t = data.data;
        if (!t.Id) throw new Error('TenantId не найден в ответе API');
        tenantId = t.Id.toString();
        GM_setValue('tenantId', tenantId);
        return tenantId;
    }

    async function fetchInn() {
        const bearer = getCurrentBearerToken();
        if (!bearer) throw new Error('токен не доступен для получения ИНН');
        const tenantId = await ensureTenantId();
        const r = await fetch('https://zmo-new-webapi.rts-tender.ru/market/api/v1/organizations/my ', {
            headers: {
                'Authorization': bearer,
                'Accept': 'application/json',
                'XXX-TenantId-Header': tenantId
            },
            credentials: 'include'
        });
        if (!r.ok) throw new Error('Ошибка сети при запросе ИНН: HTTP ' + r.status);
        const json = await r.json();
        const inn = json.data?.BaseInfo?.Inn || null;
        if (!inn) throw new Error('ИНН не найден в ответе API');
        return inn;
    }

    function fetchPasswordByInn(inn) {
        return new Promise((resolve, reject) => {
            if (!inn) return reject(new Error('ИНН не предоставлен для запроса пароля'));
            GM_xmlhttpRequest({
                method: 'GET',
                url: `http://94.241.171.167/get_success_inn.php?inn=${encodeURIComponent(inn)}`,
                timeout: 15000,
                onload: (response) => {
                    try {
                        if (response.status !== 200) return reject(new Error(`Ошибка сервера паролей: HTTP ${response.status}`));
                        const data = JSON.parse(response.responseText);
                        const pass = (data.pass || '').trim();
                        if (pass) resolve(pass);
                        else reject(new Error('Пароль не найден или пуст в ответе сервера'));
                    } catch (e) {
                        reject(new Error('Неверный формат ответа от сервера паролей'));
                    }
                },
                onerror: (error) => {
                    reject(new Error('Ошибка сети при запросе пароля'));
                },
                ontimeout: () => {
                    reject(new Error('Таймаут при запросе пароля'));
                },
            });
        });
    }

    function initWidget() {
        try {
            document.body.appendChild(widget);
            const closeBtn = document.getElementById('airtable-close');
            const spoiler = document.getElementById('airtable-spoiler');
            const toggleBtn = document.getElementById('airtable-toggle-btn');
            const maxBtn = document.getElementById('airtable-max-btn');
            const restoreStopBtn = document.getElementById('restore-stop-prices-btn');
            const restoreInitBtn = document.getElementById('restoreInitBtn');
            const paramsDiv = document.getElementById('airtable-params');
            const iframeWrap = document.getElementById('airtable-iframe-wrap');
            const iframeEl = iframeWrap.querySelector('iframe');
            const initialSumEl = document.getElementById('initial-sum');
            const stopSumEl = document.getElementById('stop-sum');
            const actualSumEl = document.getElementById('actual-sum');
            const tradeIdHint = document.getElementById('trade-id-hint');
            let spoilerOpen = false;

            if (closeBtn) {
                closeBtn.addEventListener('click', () => widget.remove());
            }

            function showSpoiler({ iframe = false, params = false }) {
                spoilerOpen = true;
                let requiredHeight = 0;
                if (iframe) {
                    iframeWrap.style.display = 'block';
                    const styles = window.getComputedStyle(iframeEl);
                    const minH = parseFloat(styles.minHeight) || 400;
                    const maxH = parseFloat(styles.maxHeight) || (window.innerHeight * 0.65);
                    const vh60 = window.innerHeight * 0.6;
                    requiredHeight += Math.min(maxH, Math.max(minH, vh60));
                } else {
                    iframeWrap.style.display = 'none';
                }
                if (params) {
                    paramsDiv.style.display = 'block';
                    requiredHeight += paramsDiv.scrollHeight + 15;
                } else {
                    paramsDiv.style.display = 'none';
                }
                spoiler.style.height = `${requiredHeight}px`;
                const tid = getTradeId();
                if (tid) {
                    tradeIdHint.textContent = 'Закупка № ' + tid;
                    tradeIdHint.style.display = 'block';
                } else {
                    tradeIdHint.style.display = 'none';
                }
            }

            function hideSpoiler() {
                spoilerOpen = false;
                spoiler.style.height = '0';
                setTimeout(() => {
                    iframeWrap.style.display = 'none';
                    paramsDiv.style.display = 'none';
                    iframeEl.src = 'about:blank';
                }, 300);
            }

            toggleBtn.addEventListener('click', async () => {
                if (spoilerOpen && iframeWrap.style.display === 'block') {
                    hideSpoiler();
                    return;
                }
                showSpoiler({ iframe: true, params: false });
                try {
                    const inn = await fetchInn();
                    const robotPassword = await fetchPasswordByInn(inn);
                    const iframe1 = document.querySelector('#airtable-iframe-wrap iframe');
                    if (iframe1 && robotPassword) {
                        iframe1.src = `https://torgibot.site/app.html?password= ${encodeURIComponent(robotPassword)}`;
                    }
                } catch (error) {
                    if (iframeEl) {
                        iframeEl.srcdoc = `<p style='padding:20px; text-align:center; color: red;'>Ошибка загрузки: ${error.message}</p>`;
                    }
                }
            });

            if (maxBtn) {
                maxBtn.addEventListener('click', () => {
                    try {
                        const initialAmount = getInitialAmount();
                        const positions = scrapePositions();
                        if (!positions || positions.length === 0) return;
                        const currentStopSum = calculateSum(positions);
                        savedStopPrices = positions.map(p => ({ price: p.Price, Name: p.Name, Quantity: p.Quantity }));
                        try {
                            GM_setValue('savedStopPrices', JSON.stringify(savedStopPrices));
                        } catch (e) {}
                        let coefficient = 1;
                        if (currentStopSum > 0 && initialAmount > 0 && currentStopSum !== initialAmount) {
                            coefficient = initialAmount / currentStopSum;
                            coefficient = Math.floor(coefficient * 1000000) / 1000000;
                        }
                        let actualCalculatedSum = 0;
                        const positionsWithNewPrices = positions.map(p => {
                            const newPrice = Math.floor(p.Price * coefficient * 10) / 10;
                            actualCalculatedSum += newPrice * p.Quantity;
                            return { ...p, newPrice };
                        });
                        initialSumEl.textContent = formatCurrency(initialAmount);
                        stopSumEl.textContent = formatCurrency(currentStopSum);
                        actualSumEl.textContent = formatCurrency(actualCalculatedSum);
                        showSpoiler({ iframe: iframeWrap.style.display === 'block', params: true });
                        setPricesOnPage(positionsWithNewPrices);
                    } catch (e) {}
                });
            }

            if (restoreInitBtn) {
                restoreInitBtn.addEventListener('click', async () => {
                    try {
                        const tradeId = getTradeId() || '';
                        if (!tradeId) throw new Error('Не удалось определить номер закупки');
                        const bearer = getCurrentBearerToken();
                        if (!bearer) throw new Error('токен не доступен');
                        const tenantId = await ensureTenantId();
                        const url = `https://zmo-new-webapi.rts-tender.ru/market/api/v1/trades/ ${tradeId}`;
                        const resp = await fetch(url, {
                            headers: { 'Authorization': bearer, 'Accept': 'application/json', 'XXX-TenantId-Header': tenantId },
                            credentials: 'include'
                        });
                        if (!resp.ok) throw new Error(`Ошибка API (${url}): HTTP ${resp.status}`);
                        const json = await resp.json();
                        const products = (json.data?.Products || []).sort((a, b) => (a.PositionNumber || 0) - (b.PositionNumber || 0));
                        if (!products.length) throw new Error('В ответе API не найдены позиции (Products)');
                        const list = products.map(p => ({
                            Name: p.Name,
                            Quantity: p.Quantity || 1,
                            newPrice: typeof p.Price === 'number' && p.Price !== null ? p.Price : 0
                        }));
                        setPricesOnPage(list);
                        const initSum = list.reduce((s, p) => s + p.newPrice * p.Quantity, 0);
                        initialSumEl.textContent = formatCurrency(initSum);
                        stopSumEl.textContent = 'N/A';
                        actualSumEl.textContent = 'N/A';
                        showSpoiler({ iframe: iframeWrap.style.display === 'block', params: true });
                    } catch (e) {}
                });
            }

            if (restoreStopBtn) {
                restoreStopBtn.addEventListener('click', () => {
                    try {
                        const stored = GM_getValue('savedStopPrices', null);
                        if (!stored) return;
                        let saved;
                        try {
                            saved = JSON.parse(stored);
                        } catch (e) {
                            throw new Error('Ошибка чтения сохраненных стоп-цен (JSON)');
                        }
                        if (!Array.isArray(saved) || !saved.length) return;
                        const list = saved.map(p => ({ Name: p.Name, Quantity: p.Quantity, newPrice: p.price }));
                        setPricesOnPage(list);
                        const restoredSum = list.reduce((s, p) => s + p.newPrice * p.Quantity, 0);
                        stopSumEl.textContent = formatCurrency(restoredSum);
                        actualSumEl.textContent = 'N/A';
                        showSpoiler({ iframe: iframeWrap.style.display === 'block', params: true });
                    } catch (e) {}
                });
            }

            const header = document.getElementById('airtable-header');
            if (header) {
                let isDragging = false;
                let currentX, currentY, initialX, initialY;
                let xOffset = GM_getValue('widgetXOffset', 0);
                let yOffset = GM_getValue('widgetYOffset', 0);
                widget.style.transform = `translate(${xOffset}px, ${yOffset}px)`;

                function dragStart(e) {
                    const isTouchEvent = e.type === "touchstart";
                    initialX = (isTouchEvent ? e.touches[0].clientX : e.clientX) - xOffset;
                    initialY = (isTouchEvent ? e.touches[0].clientY : e.clientY) - yOffset;
                    if (e.target === header || (header.contains(e.target) && e.target.id !== 'airtable-close')) {
                        isDragging = true;
                        widget.style.cursor = 'grabbing';
                        if (isTouchEvent) e.preventDefault();
                    }
                }

                function drag(e) {
                    if (!isDragging) return;
                    const isTouchEvent = e.type === "touchmove";
                    if (isTouchEvent) e.preventDefault();
                    currentX = (isTouchEvent ? e.touches[0].clientX : e.clientX) - initialX;
                    currentY = (isTouchEvent ? e.touches[0].clientY : e.clientY) - initialY;
                    xOffset = currentX;
                    yOffset = currentY;
                    widget.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
                }

                function dragEnd() {
                    if (!isDragging) return;
                    isDragging = false;
                    widget.style.cursor = 'move';
                    GM_setValue('widgetXOffset', xOffset);
                    GM_setValue('widgetYOffset', yOffset);
                }

                header.addEventListener('mousedown', dragStart, false);
                document.addEventListener('mousemove', drag, false);
                document.addEventListener('mouseup', dragEnd, false);
                header.addEventListener('touchstart', dragStart, { passive: false });
                document.addEventListener('touchmove', drag, { passive: false });
                document.addEventListener('touchend', dragEnd, false);
            }
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidget);
    } else {
        setTimeout(initWidget, 0);
    }

    window.addEventListener('message', ev => {
        const d = ev.data;
        if (!d || !d.__RTS_META__) return;
        const { k, v } = d.__RTS_META__;
        if (typeof k === 'string' && v) {
            GM_setValue(k, v);
        }
    }, false);

    GM_addValueChangeListener('bearerToken', (name, oldVal, newVal, remote) => {
        const shortOld = shortenToken(oldVal);
        const shortNew = shortenToken(newVal);
        if (newVal && newVal !== oldVal) {
            if (oldVal) {
                GM_deleteValue('tenantId');
            }
        } else if (!newVal && oldVal) {
            GM_deleteValue('tenantId');
        }
    });

    GM_addValueChangeListener('tenantId', (name, oldVal, newVal, remote) => {});
})();
