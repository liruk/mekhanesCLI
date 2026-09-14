const form = document.querySelector('#contact-form');
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#form-status');
  const button = form.querySelector('button');
  const data = Object.fromEntries(new FormData(form));
  if (!data['cf-turnstile-response']) { status.textContent = '認証が完了するまでお待ちください。'; return; }
  button.disabled = true;
  status.textContent = '送信しています…';
  try {
    const response = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '送信できませんでした。');
    status.textContent = 'お問い合わせを受け付けました。ありがとうございます。';
    form.reset();
  } catch (error) {
    status.textContent = `送信を確認できませんでした。${error.message} 入力内容は残っています。`;
  } finally {
    window.turnstile?.reset();
    button.disabled = false;
  }
});
