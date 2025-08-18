 // 1. Configuración de Supabase
        const supabaseUrl = 'https://bekzfacymgaytpgfqrzg.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJla3pmYWN5bWdheXRwZ2ZxcnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjAzNjcsImV4cCI6MjA2OTY5NjM2N30.R1hbWLGSvp6LcqqsDd-ibTGMS_mrGNl0oP-Ah-0iSt8';
        const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

        // Variables globales
        let currentExchangeRate = 115.33;
        let shippingCost = 0;
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        let products = [];
        let categories = [];
        let whatsappNumber = '584149834667'; // Valor por defecto
        let htmlName = 'Tienda Principal'; // Valor por defecto

        // Clave para el almacenamiento local con fecha de expiración
        const STORAGE_KEY = 'digital_catalog_pro_data';
        const STORAGE_EXPIRY_DAYS = 1; // 1 día de expiración

        // Obtener configuración del HTML
        const whatsappUUID = document.querySelector('meta[name="whatsapp-uuid"]')?.content;
        htmlName = document.querySelector('meta[name="html-name"]')?.content || htmlName;

        // Función para verificar si los datos en caché son válidos
        function isCacheValid(cachedData) {
            if (!cachedData || !cachedData.timestamp) return false;
            
            const expiryDate = new Date(cachedData.timestamp);
            expiryDate.setDate(expiryDate.getDate() + STORAGE_EXPIRY_DAYS);
            
            return new Date() < expiryDate;
        }

        // Función para precargar imágenes en caché
        async function preloadImages(imageUrls) {
            const promises = imageUrls.map(url => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.src = url;
                    img.onload = resolve;
                    img.onerror = resolve; // No rechazamos para que continúe con las demás
                });
            });
            
            await Promise.all(promises);
        }

        // Función para obtener configuración de WhatsApp
        async function loadWhatsAppNumber() {
            try {
                const whatsappUUID = document.querySelector('meta[name="whatsapp-uuid"]')?.content;
                
                if (!whatsappUUID) throw new Error("No se encontró el UUID en el HTML");

                const { data, error } = await supabaseClient
                    .from('whatsapp_numbers')
                    .select('phone_number, is_active')
                    .eq('id', whatsappUUID)
                    .eq('is_active', true)
                    .single();

                if (error) throw error;
                if (!data?.phone_number) throw new Error("Número no encontrado o inactivo");

                whatsappNumber = data.phone_number;
                console.log("UUID usado:", whatsappUUID, "Número configurado:", whatsappNumber);
                return true;
            } catch (error) {
                console.error("Error al cargar número:", error.message);
                alert(`Error: ${error.message}\nVerifica que el UUID ${whatsappUUID} existe y está activo en Supabase.`);
                return false;
            }
        }

        // Función para obtener configuración de la app
        async function getAppSettings() {
            try {
                const { data, error } = await supabaseClient
                    .from('app_settings')
                    .select('*')
                    .limit(1);

                if (error) throw error;
                if (data && data.length > 0) {
                    currentExchangeRate = parseFloat(data[0].rate) || 115.33;
                    shippingCost = parseFloat(data[0].shipping_cost) || 0;
                }
            } catch (error) {
                console.error("Error al cargar configuraciones:", error);
            }
        }

        // YouTube embed URL converter
        function getYouTubeEmbedUrl(url) {
            if (!url) return '';
            if (url.includes('youtube.com/embed')) return url;
            
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = url.match(regExp);
            
            return (match && match[2].length === 11) 
                ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0` 
                : url;
        }
        
        // Función para cargar productos desde Supabase o caché
        async function loadProducts() {
            try {
                // Verificar si hay datos válidos en caché
                const cachedData = JSON.parse(localStorage.getItem(STORAGE_KEY));
                
                if (isCacheValid(cachedData)) {
                    console.log("Usando datos de caché");
                    return {
                        products: cachedData.products,
                        categories: cachedData.categories
                    };
                }
                
                console.log("Obteniendo datos de Supabase");
                await getAppSettings();
                
                const { data, error } = await supabaseClient
                    .from('products')
                    .select('*');
                
                if (error) throw error;
                
                if (data && data.length > 0) {
                    const processedData = {
                        products: data.map(product => ({
                            id: product.id,
                            name: product.name || 'Unnamed Product',
                            description: product.description || '',
                            price: `Bs ${(parseFloat(product.price?.replace(/[^0-9.]/g, '') || 0) * currentExchangeRate).toFixed(2)}`,
                            originalPrice: product.price || '$0.00',
                            priceValue: parseFloat(product.price?.replace(/[^0-9.]/g, '') || 0,
                            image: product.image || 'https://via.placeholder.com/500',
                            images: product.images || [],
                            video: product.video || '',
                            sizes: product.sizes || [],
                            colors: product.colors || [],
                            badge: product.badge || '',
                            category: product.category || 'Uncategorized'
                        })),
                        categories: [...new Set(data.map(p => p.category))]
                    };
                    
                    // Guardar en caché con marca de tiempo
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({
                        ...processedData,
                        timestamp: new Date().toISOString()
                    }));
                    
                    // Precargar imágenes en caché del navegador
                    const allImageUrls = data.flatMap(product => {
                        const urls = [];
                        if (product.image) urls.push(product.image);
                        if (product.images) urls.push(...product.images.filter(img => img.trim()));
                        return urls;
                    });
                    
                    // Precargar imágenes en segundo plano
                    setTimeout(() => preloadImages(allImageUrls), 1000);
                    
                    return processedData;
                }
                
                return { products: [], categories: [] };
                
            } catch (error) {
                console.error("Error loading products:", error);
                
                // Intentar usar caché incluso si está expirada como fallback
                const cachedData = JSON.parse(localStorage.getItem(STORAGE_KEY));
                if (cachedData) {
                    console.log("Usando caché expirada como fallback");
                    return {
                        products: cachedData.products,
                        categories: cachedData.categories
                    };
                }
                
                return { products: [], categories: [] };
            }
        }

        // Display products in catalog
        function displayProducts(productsToShow) {
            const catalogEl = document.getElementById('catalog');
            catalogEl.innerHTML = '';
            
            if (!productsToShow || productsToShow.length === 0) {
                catalogEl.innerHTML = '<div class="no-results">No products found matching your search</div>';
                return;
            }
            
            productsToShow.forEach(product => {
                const productCard = document.createElement('div');
                productCard.className = 'product-card';
                
                // Badge (optional)
                const badgeHTML = product.badge 
                    ? `<div class="product-badge">${product.badge}</div>` 
                    : '';
                
                // Prepare media items
                const mediaItems = [];
                if (product.image) mediaItems.push({ type: 'image', src: product.image });
                if (product.images && product.images.length > 0) {
                    product.images.forEach(img => {
                        if (img.trim()) mediaItems.push({ type: 'image', src: img.trim() });
                    });
                }
                if (product.video && product.video.trim()) {
                    mediaItems.push({ type: 'video', src: product.video.trim() });
                }
                
                // Gallery controls
                const galleryControlsHTML = mediaItems.length > 1
                    ? mediaItems.map((media, index) => {
                        const isVideo = media.type === 'video';
                        const thumbSrc = isVideo ? (product.image || media.src) : media.src;
                        return `
                            <img src="${thumbSrc}" 
                                 class="gallery-thumbnail ${index === 0 ? 'active' : ''} ${isVideo ? 'video-thumb' : ''}" 
                                 data-type="${media.type}"
                                 data-src="${media.src}"
                                 data-index="${index}"
                                 onclick="changeMedia(this)">
                        `;
                    }).join('')
                    : '';
                
                // Current media (first by default)
                const currentMedia = mediaItems[0] || { type: 'image', src: product.image };
                let mainMediaHTML = '';
                
                if (currentMedia.type === 'video') {
                    const embedUrl = getYouTubeEmbedUrl(currentMedia.src);
                    mainMediaHTML = `
                        <iframe src="${embedUrl}" 
                                frameborder="0" 
                                allowfullscreen 
                                class="gallery-media"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                        </iframe>
                        <button class="fullscreen-btn" onclick="openFullscreen('video', '${currentMedia.src}', '${product.description.replace(/'/g, "\\'")}')">
                            <i class="fas fa-expand"></i>
                        </button>
                    `;
                } else {
                    mainMediaHTML = `
                        <img src="${currentMedia.src}" 
                             alt="${product.name}" 
                             class="gallery-media"
                             onclick="openFullscreen('image', '${currentMedia.src}', '${product.description.replace(/'/g, "\\'")}')">
                        <button class="fullscreen-btn" onclick="openFullscreen('image', '${currentMedia.src}', '${product.description.replace(/'/g, "\\'")}')">
                            <i class="fas fa-expand"></i>
                        </button>
                    `;
                }
                
                // Navigation buttons (if multiple media)
                const navButtonsHTML = mediaItems.length > 1
                    ? `
                        <button class="nav-btn prev-btn" onclick="navigateMedia(this.closest('.product-card'), -1)">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="nav-btn next-btn" onclick="navigateMedia(this.closest('.product-card'), 1)">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    `
                    : '';
                
                // Size options
                const sizesHTML = product.sizes && product.sizes.length > 0
                    ? `
                        <div class="variant-title">Size:</div>
                        <div class="variant-options size-options">
                            ${product.sizes.map((size, i) => `
                                <div class="size-option ${i === 0 ? 'selected' : ''}" 
                                     onclick="selectVariant(this, 'size')">${size.trim()}</div>
                            `).join('')}
                        </div>
                    `
                    : '';
                
                // Color options
                const colorsHTML = product.colors && product.colors.length > 0
                    ? `
                        <div class="variant-title">Color:</div>
                        <div class="variant-options color-options">
                            ${product.colors.map((color, i) => `
                                <div class="color-option ${i === 0 ? 'selected' : ''}" 
                                     style="background: ${color.trim()}" 
                                     onclick="selectVariant(this, 'color')"></div>
                            `).join('')}
                        </div>
                    `
                    : '';
                
                // Build product card HTML
                productCard.innerHTML = `
                    ${badgeHTML}
                    <div class="product-gallery">
                        <div class="gallery-container">
                            ${mainMediaHTML}
                            ${navButtonsHTML}
                        </div>
                        ${galleryControlsHTML ? `
                        <div class="gallery-controls">
                            ${galleryControlsHTML}
                        </div>
                        ` : ''}
                    </div>
                    <div class="product-info">
                        <h3 class="product-name">${product.name}</h3>
                        <span class="product-category">${product.category}</span>
                        <div class="product-price">${product.price}</div>
                        <div class="product-description">${product.description}</div>
                        
                        ${sizesHTML || colorsHTML ? `
                        <div class="variants">
                            ${sizesHTML}
                            ${colorsHTML}
                        </div>
                        ` : ''}
                        
                        <button class="add-to-cart" 
                                onclick="addToCart(
                                    '${product.id}', 
                                    '${product.name.replace(/'/g, "\\'")}', 
                                    '${product.price}', 
                                    '${product.image.replace(/'/g, "\\'")}',
                                    this.closest('.product-card')
                                )">
                            <i class="fas fa-cart-plus"></i> Add to Cart
                        </button>
                        
                        <button class="view-more-btn" onclick="toggleProductDetails(this)">
                            <i class="fas fa-chevron-down"></i> View more
                        </button>
                    </div>
                `;
                
                // Store media items for navigation
                productCard.dataset.mediaItems = JSON.stringify(mediaItems);
                productCard.dataset.currentMediaIndex = '0';
                
                catalogEl.appendChild(productCard);
            });
        }

        // Toggle product details
        function toggleProductDetails(button) {
            const productCard = button.closest('.product-card');
            const description = productCard.querySelector('.product-description');
            const variants = productCard.querySelector('.variants');
            const addToCartBtn = productCard.querySelector('.add-to-cart');
            
            // Toggle classes
            button.classList.toggle('expanded');
            
            // Toggle display
            if (button.classList.contains('expanded')) {
                description.style.display = 'block';
                if (variants) variants.style.display = 'block';
                addToCartBtn.style.display = 'flex';
                button.innerHTML = '<i class="fas fa-chevron-up"></i> View less';
            } else {
                description.style.display = 'none';
                if (variants) variants.style.display = 'none';
                addToCartBtn.style.display = 'none';
                button.innerHTML = '<i class="fas fa-chevron-down"></i> View more';
            }
        }

        // Filter products by search and category
        function filterProducts() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const selectedCategory = document.getElementById('categoryFilter').value;
            
            const filteredProducts = products.filter(product => {
                const matchesSearch = product.name.toLowerCase().includes(searchTerm) || 
                                     product.category.toLowerCase().includes(searchTerm) ||
                                     product.description.toLowerCase().includes(searchTerm);
                const matchesCategory = selectedCategory === '' || product.category === selectedCategory;
                return matchesSearch && matchesCategory;
            });
            
            displayProducts(filteredProducts);
        }

        // Change media in gallery
        function changeMedia(element) {
            const mediaType = element.getAttribute('data-type');
            const mediaSrc = element.getAttribute('data-src');
            const index = element.getAttribute('data-index');
            const productCard = element.closest('.product-card');
            const productDescription = productCard.querySelector('.product-description').textContent;
            
            productCard.querySelectorAll('.gallery-thumbnail').forEach(thumb => {
                thumb.classList.remove('active');
            });
            element.classList.add('active');
            
            updateMainMedia(productCard, mediaType, mediaSrc, index, productDescription);
        }

        // Navigate through media items
        function navigateMedia(productCard, direction) {
            const mediaItems = JSON.parse(productCard.dataset.mediaItems || '[]');
            if (mediaItems.length <= 1) return;
            
            let currentIndex = parseInt(productCard.dataset.currentMediaIndex || '0');
            currentIndex += direction;
            
            if (currentIndex < 0) currentIndex = mediaItems.length - 1;
            if (currentIndex >= mediaItems.length) currentIndex = 0;
            
            const media = mediaItems[currentIndex];
            const productDescription = productCard.querySelector('.product-description').textContent;
            updateMainMedia(productCard, media.type, media.src, currentIndex, productDescription);
            
            productCard.querySelectorAll('.gallery-thumbnail').forEach(thumb => {
                thumb.classList.remove('active');
                if (parseInt(thumb.getAttribute('data-index')) === currentIndex) {
                    thumb.classList.add('active');
                }
            });
        }

        // Update main media display
        function updateMainMedia(productCard, mediaType, mediaSrc, index, description) {
            const galleryContainer = productCard.querySelector('.gallery-container');
            const mediaItems = JSON.parse(productCard.dataset.mediaItems || '[]');
            const navButtonsHTML = mediaItems.length > 1
                ? `
                    <button class="nav-btn prev-btn" onclick="navigateMedia(this.closest('.product-card'), -1)">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button class="nav-btn next-btn" onclick="navigateMedia(this.closest('.product-card'), 1)">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                `
                : '';
            
            if (mediaType === 'video') {
                const embedUrl = getYouTubeEmbedUrl(mediaSrc);
                galleryContainer.innerHTML = `
                    <iframe src="${embedUrl}" 
                            frameborder="0" 
                            allowfullscreen 
                            class="gallery-media"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                    </iframe>
                    <button class="fullscreen-btn" onclick="openFullscreen('video', '${mediaSrc}', '${description.replace(/'/g, "\\'")}')">
                        <i class="fas fa-expand"></i>
                    </button>
                    ${navButtonsHTML}
                `;
            } else {
                galleryContainer.innerHTML = `
                    <img src="${mediaSrc}" 
                         class="gallery-media" 
                         onclick="openFullscreen('image', '${mediaSrc}', '${description.replace(/'/g, "\\'")}')">
                    <button class="fullscreen-btn" onclick="openFullscreen('image', '${mediaSrc}', '${description.replace(/'/g, "\\'")}')">
                        <i class="fas fa-expand"></i>
                    </button>
                    ${navButtonsHTML}
                `;
            }
            
            productCard.dataset.currentMediaIndex = index;
        }

        // Open media in fullscreen
        function openFullscreen(type, src, description = '') {
            const fullscreenContent = document.getElementById('fullscreenContent');
            
            if (type === 'video') {
                const embedUrl = getYouTubeEmbedUrl(src);
                fullscreenContent.innerHTML = `
                    <iframe src="${embedUrl}" 
                            frameborder="0" 
                            allowfullscreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            class="gallery-media">
                    </iframe>
                    ${description ? `<div class="product-description" style="color: white; margin-top: 15px; max-width: 800px; padding: 0 20px;">${description}</div>` : ''}
                `;
            } else {
                fullscreenContent.innerHTML = `
                    <img src="${src}" class="gallery-media">
                    ${description ? `<div class="product-description" style="color: white; margin-top: 15px; max-width: 800px; padding: 0 20px;">${description}</div>` : ''}
                `;
            }
            
            document.getElementById('fullscreenModal').classList.add('active');
            document.body.classList.add('modal-open');
        }

        // Select variant (size/color)
        function selectVariant(element, type) {
            const container = element.closest(`.${type}-options`);
            container.querySelectorAll(`.${type}-option`).forEach(opt => {
                opt.classList.remove('selected');
            });
            element.classList.add('selected');
        }

        // Add item to cart
        function addToCart(id, name, price, image, productCard) {
            const selectedSize = productCard.querySelector('.size-option.selected')?.textContent || '';
            const selectedColor = productCard.querySelector('.color-option.selected')?.style.backgroundColor || '';
            
            // Buscar el producto completo para obtener priceValue
            const product = products.find(p => p.id === id);
            const priceValue = product?.priceValue || 0;
            
            const existingItemIndex = cart.findIndex(item => 
                item.id === id && 
                item.size === selectedSize && 
                item.color === selectedColor
            );
            
            if (existingItemIndex !== -1) {
                cart[existingItemIndex].quantity += 1;
            } else {
                cart.push({
                    id,
                    name,
                    price,
                    image,
                    size: selectedSize,
                    color: selectedColor,
                    quantity: 1,
                    priceValue: priceValue
                });
            }
            
            updateCart();
            
            // Feedback animation
            const button = productCard.querySelector('.add-to-cart');
            button.innerHTML = '<i class="fas fa-check"></i> Added!';
            button.style.backgroundColor = '#2e7d32';
            setTimeout(() => {
                button.innerHTML = '<i class="fas fa-cart-plus"></i> Add to Cart';
                button.style.backgroundColor = '#4CAF50';
            }, 1000);
        }

        // Update cart display
        function updateCart() {
            localStorage.setItem('cart', JSON.stringify(cart));
            
            const cartItemsEl = document.getElementById('cartItems');
            const cartCount = document.getElementById('cartCount');
            const cartTotal = document.getElementById('cartTotal');
            const cartSubtotal = document.getElementById('cartSubtotal');
            const cartShipping = document.getElementById('cartShipping');
            const shippingInfo = document.getElementById('shippingInfo');
            
            const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
            cartCount.textContent = totalItems;
            
            const emptyMessage = cartItemsEl.querySelector('.empty-cart-message');
            
            if (cart.length === 0) {
                if (!emptyMessage) {
                    const msg = document.createElement('p');
                    msg.className = 'empty-cart-message';
                    msg.textContent = 'Your cart is empty';
                    cartItemsEl.appendChild(msg);
                }
            } else if (emptyMessage) {
                emptyMessage.remove();
            }
            
            cartItemsEl.innerHTML = '';
            
            // Mostrar mensaje de mínimo de pedido si es necesario
            if (totalItems > 0 && totalItems < 8) {
                const minOrderMsg = document.createElement('div');
                minOrderMsg.className = 'min-order-message';
                minOrderMsg.innerHTML = `⚠️ Mínimo de pedido: 8 productos (actual: ${totalItems})`;
                cartItemsEl.appendChild(minOrderMsg);
            }
            
            cart.forEach((item, index) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'cart-item';
                
                const variantsInfo = [];
                if (item.size) variantsInfo.push(`Size: ${item.size}`);
                if (item.color) variantsInfo.push(`Color: ${item.color}`);
                
                itemEl.innerHTML = `
                    <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                    <div class="item-details">
                        <div class="item-name">${item.name}</div>
                        ${variantsInfo.length ? `<div class="item-variants">${variantsInfo.join(' • ')}</div>` : ''}
                        <div class="item-price">${item.price}</div>
                        <div class="item-quantity">
                            <button class="quantity-btn minus" onclick="decreaseQuantity(${index})">-</button>
                            <input type="number" min="1" value="${item.quantity}" class="quantity-input" 
                                onchange="updateQuantity(${index}, this.value)">
                            <button class="quantity-btn plus" onclick="increaseQuantity(${index})">+</button>
                            <button class="remove-item" onclick="removeItem(${index})"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
                
                cartItemsEl.appendChild(itemEl);
            });
            
            updateTotal();
        }

        // Cart quantity functions
        function increaseQuantity(index) {
            cart[index].quantity += 1;
            updateCart();
        }
        
        function decreaseQuantity(index) {
            if (cart[index].quantity > 1) {
                cart[index].quantity -= 1;
            } else {
                cart.splice(index, 1);
            }
            updateCart();
        }
        
        function updateQuantity(index, newQuantity) {
            newQuantity = parseInt(newQuantity);
            if (isNaN(newQuantity) || newQuantity < 1) {
                newQuantity = 1;
            }
            cart[index].quantity = newQuantity;
            updateCart();
        }
        
        function removeItem(index) {
            cart.splice(index, 1);
            updateCart();
        }

        function updateTotal() {
            const cartSubtotal = document.getElementById('cartSubtotal');
            const cartTotal = document.getElementById('cartTotal');
            const cartShipping = document.getElementById('cartShipping');
            const shippingInfo = document.getElementById('shippingInfo');
            const sendWhatsAppBtn = document.getElementById('sendWhatsApp');
            
            const subtotal = cart.reduce((sum, item) => {
                return sum + (item.priceValue * item.quantity * currentExchangeRate);
            }, 0);
            
            const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
            
            cartSubtotal.textContent = `Bs ${subtotal.toFixed(2)}`;
            
            // Mostrar u ocultar información de envío según la cantidad de productos
            if (totalItems >= 8) {
                shippingInfo.classList.add('visible');
                cartShipping.textContent = `Bs ${shippingCost.toFixed(2)}`;
                cartTotal.textContent = `Bs ${(subtotal + shippingCost).toFixed(2)}`;
            } else {
                shippingInfo.classList.remove('visible');
                cartTotal.textContent = `Bs ${subtotal.toFixed(2)}`;
            }
            
            // Actualizar estado del botón de WhatsApp
            if (totalItems < 8) {
                sendWhatsAppBtn.classList.add('disabled');
                sendWhatsAppBtn.disabled = true;
            } else {
                sendWhatsAppBtn.classList.remove('disabled');
                sendWhatsAppBtn.disabled = false;
            }
        }

        // Clear cart
        function clearCart() {
            if (cart.length === 0) return;
            if (confirm('Are you sure you want to clear your cart?')) {
                cart = [];
                updateCart();
            }
        }

        // Función para validar los datos del cliente
        function validateCustomerInfo() {
            const name = document.getElementById('customerName').value.trim();
            const lastName = document.getElementById('customerLastName').value.trim();
            const idNumber = document.getElementById('customerId').value.trim();
            
            // Validar campos
            let isValid = true;
            
            if (!name) {
                document.getElementById('nameError').style.display = 'block';
                isValid = false;
            } else {
                document.getElementById('nameError').style.display = 'none';
            }
            
            if (!lastName) {
                document.getElementById('lastNameError').style.display = 'block';
                isValid = false;
            } else {
                document.getElementById('lastNameError').style.display = 'none';
            }
            
            if (!idNumber || !/^\d+$/.test(idNumber)) {
                document.getElementById('idError').style.display = 'block';
                isValid = false;
            } else {
                document.getElementById('idError').style.display = 'none';
            }
            
            return isValid;
        }
        
        // Función para enviar el pedido por WhatsApp con los datos del cliente
        function sendWhatsAppWithCustomerInfo() {
            if (!validateCustomerInfo()) return;
            
            // Verificar nuevamente la cantidad por si cambió el carrito
            const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
            if (totalItems < 8) {
                alert(`Se requieren al menos 8 productos para realizar el envío. Actualmente tiene ${totalItems} productos.`);
                return;
            }
            
            const name = document.getElementById('customerName').value.trim();
            const lastName = document.getElementById('customerLastName').value.trim();
            const idNumber = document.getElementById('customerId').value.trim();
            
            // Construir mensaje con información del cliente
            let message = `¡Hola! Me gustaría hacer un pedido:\n\n`;
            message += `*Datos del cliente:*\n`;
            message += `- Nombre completo: ${name} ${lastName}\n`;
            message += `- Cédula: ${idNumber}\n\n`;
            message += `*Detalles del pedido:*\n\n`;
            
            cart.forEach(item => {
                message += `- ${item.name}`;
                
                const variants = [];
                if (item.size) variants.push(`Talla: ${item.size}`);
                if (item.color) variants.push(`Color: ${item.color}`);
                
                if (variants.length > 0) {
                    message += ` (${variants.join(', ')})`;
                }
                
                const itemTotal = (item.priceValue * item.quantity * currentExchangeRate);
                message += ` x ${item.quantity} = Bs ${itemTotal.toFixed(2)}\n`;
            });
            
            const subtotal = cart.reduce((sum, item) => {
                return sum + (item.priceValue * item.quantity * currentExchangeRate);
            }, 0);
            
            message += `\n*Subtotal:* Bs ${subtotal.toFixed(2)}`;
            
            // Solo incluir envío si se alcanzó el mínimo
            if (totalItems >= 8) {
                message += `\n*Envío:* Bs ${shippingCost.toFixed(2)}`;
                message += `\n*Total:* Bs ${(subtotal + shippingCost).toFixed(2)}\n\n`;
            } else {
                message += `\n*Total:* Bs ${subtotal.toFixed(2)}\n\n`;
            }
            
            message += 'Por favor confirme disponibilidad y tiempo de entrega. ¡Gracias!';
            
            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
            
            // Cerrar modales
            document.getElementById('customerModal').classList.remove('active');
            document.body.classList.remove('modal-open');
            document.getElementById('cartOverlay').classList.remove('active');
            
            // Limpiar formulario
            document.getElementById('customerForm').reset();
            
            // Abrir WhatsApp
            window.open(whatsappUrl, '_blank');
        }
        
        // Función modificada para enviar por WhatsApp (ahora muestra el modal primero)
        function sendWhatsApp() {
            if (cart.length === 0) {
                alert('Su carrito está vacío');
                return;
            }
            
            // Calcular cantidad total de productos
            const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
            
            if (totalItems < 8) {
                alert(`Se requieren al menos 8 productos para realizar el envío. Actualmente tiene ${totalItems} productos.`);
                return;
            }
            
            // Mostrar el modal de datos del cliente
            document.getElementById('customerModal').classList.add('active');
            document.body.classList.add('modal-open');
        }

        // Inicialización de la aplicación
        document.addEventListener('DOMContentLoaded', async function() {
            // Elementos del DOM
            const cartButton = document.getElementById('cartButton');
            const cartOverlay = document.getElementById('cartOverlay');
            const closeCart = document.getElementById('closeCart');
            const clearCartBtn = document.getElementById('clearCart');
            const sendWhatsAppBtn = document.getElementById('sendWhatsApp');
            const fullscreenModal = document.getElementById('fullscreenModal');
            const closeFullscreen = document.getElementById('closeFullscreen');
            const customerModal = document.getElementById('customerModal');
            const customerForm = document.getElementById('customerForm');
            const cancelCustomerBtn = document.getElementById('cancelCustomer');
            
            // Event listeners
            cartButton.addEventListener('click', function() {
                document.body.classList.add('modal-open');
                cartOverlay.classList.add('active');
            });
            
            closeCart.addEventListener('click', function() {
                document.body.classList.remove('modal-open');
                cartOverlay.classList.remove('active');
            });
            
            closeFullscreen.addEventListener('click', function() {
                fullscreenModal.classList.remove('active');
                document.body.classList.remove('modal-open');
            });
            
            fullscreenModal.addEventListener('click', function(e) {
                if (e.target === fullscreenModal) {
                    fullscreenModal.classList.remove('active');
                    document.body.classList.remove('modal-open');
                }
            });
            
            customerForm.addEventListener('submit', function(e) {
                e.preventDefault();
                sendWhatsAppWithCustomerInfo();
            });
            
            cancelCustomerBtn.addEventListener('click', function() {
                customerModal.classList.remove('active');
                document.body.classList.remove('modal-open');
                document.getElementById('customerForm').reset();
                
                // Ocultar mensajes de error
                document.querySelectorAll('.form-error').forEach(el => {
                    el.style.display = 'none';
                });
            });
            
            customerModal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('active');
                    document.body.classList.remove('modal-open');
                    document.getElementById('customerForm').reset();
                    
                    // Ocultar mensajes de error
                    document.querySelectorAll('.form-error').forEach(el => {
                        el.style.display = 'none';
                    });
                }
            });
            
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    if (fullscreenModal.classList.contains('active')) {
                        fullscreenModal.classList.remove('active');
                        document.body.classList.remove('modal-open');
                    }
                    if (cartOverlay.classList.contains('active')) {
                        cartOverlay.classList.remove('active');
                        document.body.classList.remove('modal-open');
                    }
                    if (customerModal.classList.contains('active')) {
                        customerModal.classList.remove('active');
                        document.body.classList.remove('modal-open');
                    }
                }
            });
            
            clearCartBtn.addEventListener('click', clearCart);
            sendWhatsAppBtn.addEventListener('click', sendWhatsApp);
            
            // Validación en tiempo real para la cédula (solo números)
            document.getElementById('customerId').addEventListener('input', function() {
                this.value = this.value.replace(/\D/g, '');
            });
            
            // Inicializar la aplicación
            async function initApp() {
                try {
                    // Cargar configuración de WhatsApp
                    await loadWhatsAppNumber();
                    
                    // Cargar configuración de la app
                    await getAppSettings();
                    
                    // Cargar productos
                    const { products: loadedProducts, categories: loadedCategories } = await loadProducts();
                    products = loadedProducts;
                    categories = loadedCategories;
                    
                    if (products.length === 0) {
                        document.getElementById('catalog').innerHTML = `
                            <div class="error-message">
                                <i class="fas fa-info-circle"></i> No se encontraron productos en la base de datos
                            </div>
                        `;
                        return;
                    }
                    
                    // Mostrar productos
                    displayProducts(products);
                    
                    // Llenar filtro de categorías
                    const categoryFilter = document.getElementById('categoryFilter');
                    loadedCategories.forEach(category => {
                        const option = document.createElement('option');
                        option.value = category;
                        option.textContent = category;
                        categoryFilter.appendChild(option);
                    });
                    
                    // Actualizar carrito
                    updateCart();
                    
                } catch (error) {
                    console.error("Initialization error:", error);
                    document.getElementById('catalog').innerHTML = `
                        <div class="error-message">
                            <i class="fas fa-exclamation-triangle"></i> Error al cargar los productos. Por favor intente más tarde.
                        </div>
                    `;
                }
            }
            
            initApp();
        });

        // Hacer funciones accesibles globalmente
        window.changeMedia = changeMedia;
        window.navigateMedia = navigateMedia;
        window.openFullscreen = openFullscreen;
        window.selectVariant = selectVariant;
        window.addToCart = addToCart;
        window.increaseQuantity = increaseQuantity;
        window.decreaseQuantity = decreaseQuantity;
        window.updateQuantity = updateQuantity;
        window.removeItem = removeItem;
        window.clearCart = clearCart;
        window.sendWhatsApp = sendWhatsApp;
        window.toggleProductDetails = toggleProductDetails;
        window.filterProducts = filterProducts;
