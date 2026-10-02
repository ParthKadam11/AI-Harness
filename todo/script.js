document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('new-todo-form');
  const input = document.getElementById('new-todo-input');
  const list = document.getElementById('todo-list');

  function createTodoItem(text) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = text;
    const toggle = document.createElement('button');
    toggle.textContent = '✓';
    toggle.setAttribute('aria-label', 'Mark complete');
    toggle.addEventListener('click', () => {
      li.classList.toggle('completed');
    });
    const del = document.createElement('button');
    del.textContent = '✕';
    del.setAttribute('aria-label', 'Delete');
    del.addEventListener('click', () => {
      list.removeChild(li);
    });
    li.appendChild(span);
    li.appendChild(toggle);
    li.appendChild(del);
    return li;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const item = createTodoItem(text);
    list.appendChild(item);
    input.value = '';
  });
});
