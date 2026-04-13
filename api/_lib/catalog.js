export const happyCatalog = [
    { id: 'bubbaloo', name: 'Bubbaloo', price: 400, img: 'bb.png' },
    { id: 'bubbaloo-sparkies', name: 'Bubbaloo Sparkies', price: 2000, img: 'sparkies.png' },
    { id: 'quipitos', name: 'Quipitos', price: 1000, img: 'quipitos.png' },
    { id: 'piazza', name: 'Piazza', price: 800, img: 'Piazza.png' },
    { id: 'choco-disk', name: 'Choco Disk', price: 1500, img: 'chocodisk.png' },
    { id: 'bombombum-tajin', name: 'Bombombum', price: 2500, img: 'bt.png' },
    { id: 'ring-pop', name: 'Ring Pop', price: 3500, img: 'ringpop.png' },
    { id: 'cookie-chips', name: 'Cookie Chips', price: 5000, img: 'galletachocolate.png' },
    { id: 'galleta-red-velvet', name: 'Galleta Red Velvet', price: 6000, img: 'redvelvet.png' },
    { id: 'brownie-avellana', name: 'Brownie Avellana', price: 5000, img: 'browniea.png' },
    { id: 'galleta-choco-arequipe', name: 'Galleta Choco Arequipe', price: 6000, img: 'galletachocoa.png' },
    { id: 'brownie-arequipe', name: 'Brownie Arequipe', price: 5000, img: 'browniear.png' },
    { id: 'pizza-normal', name: 'Pizza', price: 11000, img: 'pizza.png' }
];

export function getPriceByName(productName) {
    // Busca producto ignorando mayúsculas/minúsculas y espacios innecesarios
    const cleanSearch = productName.trim().toLowerCase();
    const match = happyCatalog.find(p => cleanSearch.includes(p.name.toLowerCase()));
    return match ? match.price : 0;
}
