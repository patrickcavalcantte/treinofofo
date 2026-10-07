// Foto de perfil: fica dentro dos dados da conta (pequena, quadrada), sem servidor de imagens.
// As funções puras são testadas em tests/avatar.test.js; `squareFromFile` roda só no navegador.

export const AVATAR_SIZE = 160; // px, lado do quadrado
export const AVATAR_MAX_CHARS = 60_000; // limite do texto da imagem (~45 KB), muito acima de uma foto de 160 px
const PREFIX = "data:image/jpeg;base64,";

const iso = (now) => new Date(now).toISOString();

export function validAvatar(data) {
  return typeof data === "string" && data.startsWith(PREFIX) && data.length > PREFIX.length && data.length <= AVATAR_MAX_CHARS
    && /^[A-Za-z0-9+/=]+$/.test(data.slice(PREFIX.length));
}

export function saveAvatar(state, data, now) {
  if (!validAvatar(data)) throw new Error("Não foi possível usar essa foto. Tente outra.");
  return { ...state, avatar: { data, updatedAt: iso(now) } };
}

/** Remover deixa um marcador, para a remoção valer nos outros aparelhos. */
export const removeAvatar = (state, now) => ({ ...state, avatar: { data: null, updatedAt: iso(now) } });

export const avatarSrc = (state) => (validAvatar(state.avatar?.data) ? state.avatar.data : null);

/** Recorta o centro da imagem em quadrado, reduz e devolve um JPEG em texto. Só no navegador. */
export async function squareFromFile(file, size = AVATAR_SIZE) {
  if (!file || !/^image\//.test(file.type)) throw new Error("Escolha um arquivo de imagem.");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // fotos com fundo transparente (PNG) viram JPEG sem ficar pretas
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close?.();
  return canvas.toDataURL("image/jpeg", 0.82);
}
