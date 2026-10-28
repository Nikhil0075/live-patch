const id = new URLSearchParams(location.search).get('id') ?? '';
if (!/^[\w-]+$/.test(id)) document.querySelector('#error')!.textContent = 'Choose a saved build from the Builds page.';
else {
  document.querySelector<HTMLIFrameElement>('#original')!.src = `/preview.html?compare=${encodeURIComponent(id)}&original=1`;
  document.querySelector<HTMLIFrameElement>('#evolved')!.src = `/preview.html?compare=${encodeURIComponent(id)}`;
}
