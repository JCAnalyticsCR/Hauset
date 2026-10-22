export const site = {
  name: 'HAUSET',
  tagline: 'Automatización · Seguridad · Redes',
  phone: '+506 6090-2549',
  phoneHref: 'tel:+50660902549',
  email: 'ventas@hausetcr.com',
  instagram: 'https://www.instagram.com/hausetcr/',
  whatsapp: 'https://wa.me/50660902549',
  description:
    'Automatización, cámaras de seguridad y redes WiFi para hogares y negocios en Costa Rica. Soluciones a tu medida con acompañamiento de HAUSET.',
};

export const whatsapp = (
  message = 'Hola HAUSET, quiero una cotización para mi hogar o negocio.',
) => `${site.whatsapp}?text=${encodeURIComponent(message)}`;

export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const asset = (path: string) => `${base}/${path.replace(/^\//, '')}`;
