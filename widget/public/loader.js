/**
 * OmniPro Chat Widget Loader
 * Usage: <script src="https://your-domain.com/loader.js" data-channel-id="YOUR_CHANNEL_ID"></script>
 */
(function() {
  'use strict';

  var script = document.currentScript;
  var channelId = script.getAttribute('data-channel-id') || '';
  var apiUrl = script.getAttribute('data-api-url') || 'http://localhost:3001';
  var widgetUrl = script.getAttribute('data-widget-url') || 'http://localhost:3002';
  var position = script.getAttribute('data-position') || 'right';
  var color = script.getAttribute('data-color') || '#4F46E5';

  // Create widget container
  var container = document.createElement('div');
  container.id = 'omnipro-widget-container';
  container.style.cssText = 'position:fixed;bottom:20px;' + position + ':20px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  // Chat button
  var button = document.createElement('div');
  button.id = 'omnipro-widget-button';
  button.style.cssText = 'width:60px;height:60px;border-radius:50%;background:' + color + ';cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform 0.3s ease;';
  button.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="white"/><path d="M7 9H17V11H7V9ZM7 6H17V8H7V6ZM7 12H14V14H7V12Z" fill="white"/></svg>';
  button.onmouseover = function() { button.style.transform = 'scale(1.1)'; };
  button.onmouseout = function() { button.style.transform = 'scale(1)'; };

  // Notification badge
  var badge = document.createElement('div');
  badge.id = 'omnipro-badge';
  badge.style.cssText = 'display:none;position:absolute;top:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:white;font-size:12px;display:flex;align-items:center;justify-content:center;display:none;';
  badge.textContent = '1';
  button.appendChild(badge);

  // Chat iframe
  var iframe = document.createElement('iframe');
  iframe.id = 'omnipro-widget-iframe';
  iframe.src = widgetUrl + '/widget?channelId=' + channelId + '&apiUrl=' + encodeURIComponent(apiUrl) + '&color=' + encodeURIComponent(color);
  iframe.style.cssText = 'display:none;width:380px;height:520px;border:none;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);margin-bottom:12px;background:white;';
  iframe.setAttribute('allow', 'microphone;camera');

  var isOpen = false;
  button.onclick = function() {
    isOpen = !isOpen;
    iframe.style.display = isOpen ? 'block' : 'none';
    button.innerHTML = isOpen
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="white"/></svg>'
      : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="white"/><path d="M7 9H17V11H7V9ZM7 6H17V8H7V6ZM7 12H14V14H7V12Z" fill="white"/></svg>';
    if (isOpen) {
      badge.style.display = 'none';
    }
  };

  // Listen for messages from iframe
  window.addEventListener('message', function(event) {
    if (event.data.type === 'omnipro-new-message' && !isOpen) {
      badge.style.display = 'flex';
      badge.textContent = (parseInt(badge.textContent) || 0) + 1;
    }
    if (event.data.type === 'omnipro-close') {
      isOpen = false;
      iframe.style.display = 'none';
      button.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="white"/><path d="M7 9H17V11H7V9ZM7 6H17V8H7V6ZM7 12H14V14H7V12Z" fill="white"/></svg>';
    }
  });

  container.appendChild(iframe);
  container.appendChild(button);
  document.body.appendChild(container);
})();
