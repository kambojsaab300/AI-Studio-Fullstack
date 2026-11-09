// ============================================================
// AI Studio: Tool Categories & Taxonomy
// Each category has an emoji (used in older screens) and a lucide icon + short description (Tool Builder).
// Each tool has a lucide icon and a one-line "what it does" (TOOL_INFO).
// ============================================================

import {
    Layers, Shirt, Briefcase, Flower2, Shuffle, Images, Ruler, Footprints,
    Package, Box, Layers3, LayoutGrid, Utensils, Megaphone, Eye, Sticker, Type,
    Gem, Watch, Glasses, Sparkles, Star, Camera, Heart, Users, Scissors, Smile, Wand2, Brush,
    Sofa, PaintRoller, Baby, MessageSquare, ScanText, Tag, ShieldCheck, Wrench
} from 'lucide-react';

export const TOOL_CATEGORIES = [
    { id: 'all', label: 'All Tools', icon: '✨', Icon: Layers, desc: 'Saare tools ek saath' },
    { id: 'fashion', label: 'Fashion & Apparel', icon: '👗', Icon: Shirt, desc: 'Model ko kapde, suit, saree, jeans aur shoes pehnana' },
    { id: 'catalog', label: 'Product & E-Commerce', icon: '📦', Icon: Package, desc: 'Product photo, catalog, banner, poster aur sticker' },
    { id: 'tryon', label: 'Virtual Try-On', icon: '💎', Icon: Gem, desc: 'Jewellery, chashma, ghadi aur earring ka virtual try-on' },
    { id: 'portrait', label: 'Portraits & Wedding', icon: '📸', Icon: Camera, desc: 'Wedding, family, couple, hair aur makeup photo' },
    { id: 'arch', label: 'Spaces & Interior', icon: '🏠', Icon: Sofa, desc: 'Room redesign, ghar ka paint, bachon ke photo' },
    { id: 'vision', label: 'AI Vision & Chat', icon: '👁️', Icon: Eye, desc: 'Chat, photo padhna, text aur moderation' }
];

// Used for tools whose slug is not in any category above
export const OTHER_CATEGORY = { id: 'utility', label: 'Other Tools', icon: '🧩', Icon: Wrench, desc: 'Baaki tools' };

// task_type -> [icon, what the tool does]
const TOOL_INFO = {
    // Fashion & Apparel
    batch_model_to_garment: [Shirt, 'Model par garment pehnata hai (batch mein)'],
    suit_studio: [Briefcase, 'Suit ka studio shot banata hai'],
    saree_lehenga_studio: [Flower2, 'Saree ya lehenga ko model par dikhata hai'],
    ghost_mannequin: [Layers, 'Ghost mannequin: kapde bina model ke, 3D jaisa look'],
    outfit_change: [Shuffle, 'Model ka outfit badalta hai'],
    outfit_change_ref: [Images, 'Reference photo dekh kar outfit badalta hai'],
    man_shirt: [Shirt, 'Mard model par shirt pehnata hai'],
    man_suit: [Briefcase, 'Mard model par suit pehnata hai'],
    man_jeans: [Ruler, 'Mard model par jeans pehnata hai'],
    man_shorts: [Ruler, 'Mard model par shorts pehnata hai'],
    man_shoes: [Footprints, 'Mard model par shoes pehnata hai'],
    shirt_change: [Shirt, 'Shirt ka rang ya design badalta hai'],
    suit_change: [Briefcase, 'Suit ka rang ya design badalta hai'],
    woman_shoes: [Footprints, 'Female model par shoes pehnata hai'],
    // Product & E-Commerce
    combo_5pose_studio: [LayoutGrid, '5 poses ka combo studio shot'],
    luxury_product_podium: [Box, 'Luxury podium par product ka shot'],
    food_photography_studio: [Utensils, 'Khane ki professional photo'],
    festival_sale_banner: [Megaphone, 'Festival sale ka banner'],
    product_angles: [Eye, 'Product ke alag-alag angles'],
    product_catalog: [Package, 'Catalog ke liye ready product photo'],
    product_scene: [Images, 'Product ko scene ke andar rakhta hai'],
    mockup: [Layers3, 'Product ka mockup banata hai'],
    sticker_logo: [Sticker, 'Sticker aur logo design'],
    poster_text: [Type, 'Text ke saath poster design'],
    // Virtual Try-On
    jewellery_tryon: [Gem, 'Jewellery ka virtual try-on'],
    watch_sunglasses_tryon: [Watch, 'Ghadi aur chashma ka try-on'],
    virtual_tryon: [Sparkles, 'General virtual try-on'],
    man_glasses: [Glasses, 'Mard ke liye chashma try-on'],
    woman_glasses: [Glasses, 'Female ke liye chashma try-on'],
    woman_earrings: [Sparkles, 'Female ke liye earring try-on'],
    woman_nose_pin: [Star, 'Female ke liye nose pin try-on'],
    // Portraits & Wedding
    prewedding_studio: [Camera, 'Prewedding photo shoot'],
    bridal_makeup_studio: [Brush, 'Dulhan ka makeup look'],
    couple_photo: [Heart, 'Couple ki photo'],
    family_photo: [Users, 'Family group photo'],
    hair_salon_studio: [Scissors, 'Salon style hair look'],
    hair_change: [Scissors, 'Hairstyle badalta hai'],
    face_swap: [Smile, 'Ek chehre ko dusre chehre se swap karta hai'],
    pose_change: [Wand2, 'Photo mein pose badalta hai'],
    // Spaces & Interior
    room_interior_redesign: [Sofa, 'Room ka interior redesign'],
    house_exterior_paint: [PaintRoller, 'Ghar ke bahar ka paint preview'],
    kids_milestone_studio: [Baby, 'Bachon ke milestone ki photo'],
    // AI Vision & Chat
    chat: [MessageSquare, 'AI se chat (text aur photo)'],
    photo_read: [Eye, 'Photo mein kya hai, ye padhta hai'],
    product_tag: [Tag, 'Product ke tags aur details nikaalta hai'],
    ocr_text: [ScanText, 'Image se text (OCR) nikaalta hai'],
    moderation_check: [ShieldCheck, 'Photo safe hai ya nahi, check karta hai']
};

export function getToolCategory(taskType) {
    if ([
        'batch_model_to_garment', 'suit_studio', 'saree_lehenga_studio',
        'ghost_mannequin', 'outfit_change', 'outfit_change_ref',
        'man_shirt', 'man_suit', 'man_jeans', 'man_shorts',
        'man_shoes', 'shirt_change', 'suit_change', 'woman_shoes'
    ].includes(taskType)) return 'fashion';

    if ([
        'combo_5pose_studio', 'luxury_product_podium', 'food_photography_studio',
        'festival_sale_banner', 'product_angles', 'product_catalog',
        'product_scene', 'mockup', 'sticker_logo', 'poster_text'
    ].includes(taskType)) return 'catalog';

    if ([
        'jewellery_tryon', 'watch_sunglasses_tryon', 'virtual_tryon',
        'man_glasses', 'woman_glasses', 'woman_earrings', 'woman_nose_pin'
    ].includes(taskType)) return 'tryon';

    if ([
        'prewedding_studio', 'bridal_makeup_studio', 'couple_photo',
        'family_photo', 'hair_salon_studio', 'hair_change',
        'face_swap', 'pose_change'
    ].includes(taskType)) return 'portrait';

    if ([
        'room_interior_redesign', 'house_exterior_paint',
        'kids_milestone_studio'
    ].includes(taskType)) return 'arch';

    if ([
        'chat', 'photo_read', 'product_tag', 'ocr_text', 'moderation_check'
    ].includes(taskType)) return 'vision';

    return 'utility';
}

// Icon, category and built-in description for a tool. Falls back to the category icon.
export function getToolInfo(taskType) {
    const category = TOOL_CATEGORIES.find(c => c.id === getToolCategory(taskType)) || OTHER_CATEGORY;
    const info = TOOL_INFO[taskType];
    return {
        Icon: info?.[0] || category.Icon,
        desc: info?.[1] || '',
        category
    };
}
