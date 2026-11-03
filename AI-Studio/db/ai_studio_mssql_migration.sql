-- =====================================================
-- AI STUDIO: FULL MICROSOFT SQL SERVER SCHEMA & SEED
-- Migrated from Supabase PostgreSQL
-- =====================================================

-- 1. Authentication Table (Admin & Customers)

IF OBJECT_ID('ai_studio_users', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_users (
        id NVARCHAR(100) PRIMARY KEY DEFAULT NEWID(),
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        role NVARCHAR(50) NOT NULL DEFAULT 'customer', -- 'admin' or 'customer'
        created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
END
GO


IF OBJECT_ID('ai_studio_admins', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_admins (
        user_id NVARCHAR(100) PRIMARY KEY,
        created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
END
GO


IF OBJECT_ID('ai_studio_settings', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_settings (
        id INT PRIMARY KEY DEFAULT 1,
        task_concurrency INT NOT NULL DEFAULT 20,
        gemini_concurrency INT NOT NULL DEFAULT 8,
        photos_per_task_max INT NOT NULL DEFAULT 10,
        cloudinary_enabled BIT NOT NULL DEFAULT 1,
        cloudinary_cloud_name NVARCHAR(100) NOT NULL DEFAULT 'draaqjcre',
        cloudinary_upload_preset NVARCHAR(100) NOT NULL DEFAULT 'ml_default',
        imgbb_enabled BIT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 2,
        retry_delay_sec INT NOT NULL DEFAULT 30,
        task_timeout_sec INT NOT NULL DEFAULT 300,
        alert_queue_size INT NOT NULL DEFAULT 50,
        user_daily_task_limit INT NOT NULL DEFAULT 0,
        daily_gemini_budget INT NOT NULL DEFAULT 0,
        maintenance_on BIT NOT NULL DEFAULT 0,
        maintenance_message NVARCHAR(MAX) NOT NULL DEFAULT 'System abhi maintenance mein hai. Thodi der baad try karo.',
        alert_email_enabled BIT NOT NULL DEFAULT 0,
        alert_admin_email NVARCHAR(255) NOT NULL DEFAULT '',
        alert_sender_email NVARCHAR(255) NOT NULL DEFAULT '',
        alert_sender_name NVARCHAR(255) NOT NULL DEFAULT 'AI Studio',
        alert_cooldown_min INT NOT NULL DEFAULT 15,
        match_model NVARCHAR(100) NOT NULL DEFAULT 'gemini-3-flash-preview',
        match_threshold INT NOT NULL DEFAULT 70,
        match_retries INT NOT NULL DEFAULT 2,
        gemini_base NVARCHAR(500) NOT NULL DEFAULT 'https://generativelanguage.googleapis.com/v1beta/models',
        imgbb_upload_url NVARCHAR(500) NOT NULL DEFAULT 'https://api.imgbb.com/1/upload',
        stale_min INT NOT NULL DEFAULT 10,
        image_max_side INT NOT NULL DEFAULT 2048,
        image_quality DECIMAL(3,2) NOT NULL DEFAULT 0.85,
        heartbeat_sec INT NOT NULL DEFAULT 30,
        fallback_sec INT NOT NULL DEFAULT 600,
        updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );

    IF NOT EXISTS (SELECT 1 FROM ai_studio_settings WHERE id = 1)
    BEGIN
        INSERT INTO ai_studio_settings (id) VALUES (1);
    END
END
GO


IF OBJECT_ID('ai_studio_secrets', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_secrets (
        id INT PRIMARY KEY DEFAULT 1,
        imgbb_api_key NVARCHAR(MAX) NULL,
        brevo_api_key NVARCHAR(MAX) NULL
    );

    IF NOT EXISTS (SELECT 1 FROM ai_studio_secrets WHERE id = 1)
    BEGIN
        INSERT INTO ai_studio_secrets (id, imgbb_api_key, brevo_api_key) VALUES (1, '', '');
    END
END
GO


IF OBJECT_ID('ai_studio_tools', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_tools (
        tool NVARCHAR(50) PRIMARY KEY,
        label NVARCHAR(100) NOT NULL,
        enabled BIT NOT NULL DEFAULT 1,
        created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );

    INSERT INTO ai_studio_tools (tool, label) VALUES
        ('chat', 'Chat / text tool'),
        ('image', 'Image tool');
END
GO


IF OBJECT_ID('ai_studio_models', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_models (
        model_id NVARCHAR(100) PRIMARY KEY,
        kind NVARCHAR(50) NOT NULL DEFAULT 'image',
        label NVARCHAR(100) NOT NULL,
        aspects NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        sizes NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        enabled BIT NOT NULL DEFAULT 1
    );

    INSERT INTO ai_studio_models (model_id, kind, label, aspects, sizes, enabled) VALUES
        ('gemini-3.1-flash-image-preview', 'image', 'AI Studio 3.1 Flash Image', '["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"]', '["1K","2K","4K"]', 1),
        ('gemini-2.5-flash-image-preview', 'image', 'AI Studio 2.5 Flash Image', '["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"]', '[]', 1),
        ('gemini-3-flash-preview', 'text', 'AI Studio 3 Flash (text)', '[]', '[]', 1),
        ('gemini-2.5-flash', 'text', 'AI Studio 2.5 Flash (text)', '[]', '[]', 1);
END
GO


IF OBJECT_ID('ai_studio_task_catalog', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_task_catalog (
        task_type NVARCHAR(100) PRIMARY KEY,
        label NVARCHAR(100) NOT NULL,
        customer_label NVARCHAR(100) NULL,
        hint NVARCHAR(MAX) NULL,
        output NVARCHAR(20) NOT NULL,
        inputs NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        optional NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        labels NVARCHAR(MAX) NOT NULL DEFAULT '{}',
        customer_labels NVARCHAR(MAX) NULL,
        extras BIT NOT NULL DEFAULT 0,
        prompt_required BIT NOT NULL DEFAULT 0,
        face_check BIT NOT NULL DEFAULT 0,
        edit BIT NOT NULL DEFAULT 0,
        transparent BIT NOT NULL DEFAULT 0,
        angles NVARCHAR(MAX) NULL,
        family BIT NOT NULL DEFAULT 0,
        per_photo BIT NOT NULL DEFAULT 0,
        customer_visible BIT NOT NULL DEFAULT 0,
        enabled BIT NOT NULL DEFAULT 1,
        sort INT NOT NULL DEFAULT 0,
        updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
END
GO

-- Seed Task Catalog Rows
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'chat')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('chat', 'Chat (sirf text)', 'Chat', 'Sawal poocho. Same conversation ID se purani baat yaad rehti hai.', 'text', '[]', '[]', '{}', '{}', 0, 1, 0, 0, 0, null, 0, 1, 10);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'photo_read')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('photo_read', 'Photo Read → Text', 'Photo ke baare mein batao', 'Photo do, uske baare mein text jawab milega.', 'text', '["input"]', '[]', '{}', '{}', 1, 0, 0, 0, 0, null, 0, 1, 20);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'text_to_image')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('text_to_image', 'Prompt → Photo', 'Prompt se photo banao', 'Sirf apna prompt likho, photo ban jayegi.', 'image', '[]', '[]', '{}', '{}', 0, 1, 0, 0, 0, null, 0, 1, 30);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'image_prompt')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('image_prompt', 'Image + Prompt → Photo', 'Ek photo + prompt se nayi photo banao', 'Ek photo aur prompt do. Chaho to aur photos bhi de sakte ho.', 'image', '["input"]', '[]', '{}', '{}', 1, 1, 0, 0, 0, null, 0, 1, 40);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'image_to_image')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('image_to_image', 'Image → Image (face + style)', 'Apna chehra + style se photo banao', 'Apna chehra aur jo kapde / style chahiye uski photo do.', 'image', '["face", "style"]', '[]', '{}', '{}', 0, 0, 1, 0, 0, null, 0, 1, 50);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'image_to_image_prompt')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('image_to_image_prompt', 'Image → Image + Prompt', 'Chehra + style + prompt se photo banao', 'Chehra, style photo aur prompt do.', 'image', '["face", "style"]', '[]', '{}', '{}', 0, 1, 1, 0, 0, null, 0, 1, 60);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'outfit_change')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('outfit_change', 'Outfit change (person + naya outfit)', 'Outfit badlo (aap wahi, naya outfit)', 'Apni photo aur jo outfit pehnana hai uski photo do.', 'image', '["face", "style"]', '[]', '{"face":"Person ki photo","style":"Naye outfit ki photo"}', '{"face":"Apni photo","style":"Naye outfit ki photo"}', 0, 0, 1, 0, 0, null, 0, 1, 70);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'background_change')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('background_change', 'Background change (person + naya background)', 'Background badlo (aap wahi, naya background)', 'Aap same rahoge, sirf background badlega.', 'image', '["face", "style"]', '[]', '{"face":"Person ki photo","style":"Naye background ki photo"}', '{"face":"Apni photo","style":"Naye background ki photo"}', 0, 0, 1, 0, 0, null, 0, 1, 80);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'virtual_tryon')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('virtual_tryon', 'Virtual try-on (customer + product)', 'Virtual try-on (product aap par dekho)', 'Apni photo aur product ki photo do. Product aap par dikhega.', 'image', '["face", "style"]', '[]', '{"face":"Customer / model ki photo","style":"Product ki photo (kapda, jewellery, bag)"}', '{"face":"Apni photo","style":"Product ki photo (kapda, jewellery, bag)"}', 0, 0, 1, 0, 0, null, 0, 1, 90);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'product_scene')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('product_scene', 'Product scene (product scene mein)', 'Product ko scene mein dikhao', 'Product ki photo do, aur batao kahan dikhana hai (cafe, beach, studio).', 'image', '["face", "style"]', '["style"]', '{"face":"Product ki photo","style":"Scene / background ki photo (optional)"}', '{"face":"Product ki photo","style":"Scene ki photo (optional)"}', 0, 1, 0, 0, 0, null, 0, 1, 100);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'product_catalog')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('product_catalog', 'Product catalog photo', 'Product catalog photo', 'Product ki photo do. Prompt mein angle batao (jaise front view, side view).', 'image', '["face"]', '[]', '{"face":"Product ki photo"}', '{"face":"Product ki photo"}', 0, 0, 0, 0, 0, null, 0, 1, 110);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'project_image')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('project_image', 'Project image (design se naya visual)', 'Design / project se naya visual', 'Design ki photo do, aur batao kaisa visual chahiye.', 'image', '["face", "style"]', '["style"]', '{"face":"Design / project ki photo","style":"Style reference (optional)"}', '{"face":"Design / project ki photo","style":"Style reference (optional)"}', 0, 1, 0, 0, 0, null, 0, 1, 120);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'image_edit')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('image_edit', 'Photo edit (brush se area badlo)', 'Photo ka hissa badlo (brush se)', 'Photo do, phir brush se jo hissa badalna hai use laal karo. Sirf wahi hissa badlega. Prompt mein batao kya karna hai: rang badlo, text add karo, ya text hatao.', 'image', '["face", "style"]', '[]', '{"face":"Edit wali photo","style":"Mask (brush se select kiya area)"}', '{"face":"Edit wali photo","style":"Mask (brush se area select karo)"}', 0, 1, 0, 1, 0, null, 0, 1, 130);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'hair_change')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('hair_change', 'Hair change (brush se baal)', 'Baal badlo (brush se)', 'Photo do, phir brush se baal wala hissa laal karo. Prompt mein batao: kaisa hairstyle, rang ya length.', 'image', '["face", "style"]', '[]', '{"face":"Photo","style":"Mask (brush se baal wala area)"}', '{"face":"Apni photo","style":"Mask (brush se baal wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 140);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'shirt_change')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('shirt_change', 'Shirt / top change (brush se)', 'Shirt / top badlo (brush se)', 'Photo do, phir brush se shirt wala hissa laal karo. Prompt mein batao: rang, kapda ya design.', 'image', '["face", "style"]', '[]', '{"face":"Photo","style":"Mask (brush se shirt wala area)"}', '{"face":"Apni photo","style":"Mask (brush se shirt wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 150);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'suit_change')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('suit_change', 'Suit change (brush se)', 'Suit badlo (brush se)', 'Photo do, phir brush se outfit wala hissa laal karo. Prompt mein batao: suit ka rang aur style.', 'image', '["face", "style"]', '[]', '{"face":"Photo","style":"Mask (brush se outfit wala area)"}', '{"face":"Apni photo","style":"Mask (brush se outfit wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 160);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'bg_change')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('bg_change', 'Background change (brush se background)', 'Background badlo (brush se, aap wahi rahoge)', 'Photo do, phir brush se background wala hissa laal karo. Aap same rahoge. Prompt mein naya background batao.', 'image', '["face", "style"]', '[]', '{"face":"Photo","style":"Mask (brush se background wala area)"}', '{"face":"Apni photo","style":"Mask (brush se background wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 170);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'face_swap')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('face_swap', 'Face swap (apna chehra reference par)', 'Face swap (apna chehra reference photo par)', 'Apne chehre ki photo do aur jis photo par lagana hai woh do. Reference photo ka pose, kapde aur background same rahenge.', 'image', '["face", "style"]', '[]', '{"face":"Aapka chehra (face photo)","style":"Reference photo (jisme chehra lagana hai)"}', '{"face":"Aapka chehra (face photo)","style":"Reference photo (jisme chehra lagana hai)"}', 0, 0, 1, 0, 0, null, 0, 1, 180);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'couple_photo')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('couple_photo', 'Couple photo (girl + boy)', 'Couple photo (ladki + ladka)', 'Ladki ki photo aur ladke ki photo do. Chaho to prompt mein pose ya jagah batao (jaise beach, cafe).', 'image', '["face", "style"]', '[]', '{"face":"Girl ki photo","style":"Boy ki photo"}', '{"face":"Ladki ki photo","style":"Ladke ki photo"}', 0, 0, 0, 0, 0, null, 0, 1, 190);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'family_photo')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('family_photo', 'Family photo (parivar)', 'Family photo (parivar ek saath)', 'Jo log photo mein chahiye unki photo do: aadmi, aurat, baby boy, baby girl, dadi / nani, dada / nana. Jo nahi hai use khali chhodo. Kam se kam 2 photos chahiye.', 'image', '[]', '[]', '{}', '{}', 1, 0, 0, 0, 0, null, 1, 1, 200);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'outfit_change_ref')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('outfit_change_ref', 'Outfit change (face ref + outfit + photo ref)', 'Outfit badlo (chehra + photo + outfit)', 'Teen photos do: aapka chehra, outfit ki photo, aur wo photo jis mein outfit badalna hai. Chehra same rahega.', 'image', '["face", "style", "input"]', '[]', '{"face":"Chehra ref (identity)","style":"Outfit ki photo","input":"Photo ref (jis photo mein outfit badalna hai)"}', '{"face":"Chehra ref (aapka chehra)","style":"Outfit ki photo","input":"Photo ref (jis photo mein outfit badalna hai)"}', 0, 0, 1, 0, 0, null, 0, 1, 210);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'ocr_text')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('ocr_text', 'OCR (photo se text padho)', 'Photo se text padho (OCR)', 'Bill, label, card ya kisi bhi photo ka text padh kar dikhayega.', 'text', '["input"]', '[]', '{"input":"Photo (jis mein text hai)"}', '{"input":"Photo (jis mein text hai)"}', 0, 0, 0, 0, 0, null, 0, 1, 220);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'product_tag')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('product_tag', 'Product tag (rang, material, category)', 'Product ke tags (rang, material, category)', 'Product ki photo do. Rang, material, category aur chhota title milega.', 'text', '["input"]', '[]', '{"input":"Product ki photo"}', '{"input":"Product ki photo"}', 0, 0, 0, 0, 0, null, 0, 1, 230);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'moderation_check')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('moderation_check', 'Photo check (blur / inappropriate)', 'Photo check (blur / inappropriate)', 'Photo blur hai ya nahi, aur content theek hai ya nahi, ye batayega.', 'text', '["input"]', '[]', '{"input":"Check karne wali photo"}', '{"input":"Check karne wali photo"}', 0, 0, 0, 0, 0, null, 0, 1, 240);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'poster_text')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('poster_text', 'Poster / banner (text ke saath)', 'Poster / banner (apna text likho)', 'Jo text chahiye prompt mein likho (naam, price, offer). Photo dena optional hai.', 'image', '["face"]', '["face"]', '{"face":"Main photo / product (optional)"}', '{"face":"Main photo (optional)"}', 0, 1, 0, 0, 0, null, 0, 1, 250);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'sticker_logo')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('sticker_logo', 'Logo / sticker (transparent)', 'Logo / sticker (transparent)', 'Logo ya sticker ka description likho. Background transparent hoga.', 'image', '[]', '[]', '{}', '{}', 0, 1, 0, 0, 1, null, 0, 1, 260);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'remove_bg')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('remove_bg', 'Background remove (transparent PNG)', 'Background hatao (transparent PNG)', 'Photo do, background hat jayega aur transparent PNG milegi.', 'image', '["face"]', '[]', '{"face":"Product / photo"}', '{"face":"Product / photo"}', 0, 0, 0, 0, 1, null, 0, 1, 270);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'restore_photo')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('restore_photo', 'Photo restore / upscale', 'Purani photo sudharo (restore)', 'Purani ya blur photo do. Chehra same rahega, quality badhegi.', 'image', '["face"]', '[]', '{"face":"Purani / kam quality photo"}', '{"face":"Purani / kam quality photo"}', 0, 0, 1, 0, 0, null, 0, 1, 280);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'outpaint')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('outpaint', 'Aspect extend (bina crop ke)', 'Photo ka aspect badhao (bina crop)', 'Photo ko naye aspect (jaise 9:16) mein bada kiya jayega. Subject same rahega.', 'image', '["face"]', '[]', '{"face":"Photo (aspect badhana hai)"}', '{"face":"Photo"}', 0, 0, 1, 0, 0, null, 0, 1, 290);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'style_transfer')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('style_transfer', 'Style transfer (sketch, painting, cartoon)', 'Style badlo (sketch, painting, cartoon)', 'Photo do, aur prompt mein style batao: sketch, oil painting, cartoon.', 'image', '["face"]', '[]', '{"face":"Photo"}', '{"face":"Photo"}', 0, 1, 0, 0, 0, null, 0, 1, 300);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'mockup')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('mockup', 'Mockup (design ko product par)', 'Mockup (design product par)', 'Design ki photo aur product ki photo do. Design product par print dikhega.', 'image', '["face", "style"]', '[]', '{"face":"Design / artwork","style":"Product photo (t-shirt, mug, bag)"}', '{"face":"Design / artwork","style":"Product photo (t-shirt, mug, bag)"}', 0, 0, 0, 0, 0, null, 0, 1, 310);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'product_angles')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('product_angles', 'Product multi-angle (alag angles)', 'Product ke alag angles', 'Product ki photo do. Har photo mein alag angle hoga (front, side, back, top). Batch se photos badhao.', 'image', '["face"]', '[]', '{"face":"Product ki photo"}', '{"face":"Product ki photo"}', 0, 0, 0, 0, 0, '["front view", "left side view", "back view", "three-quarter view", "top view"]', 0, 1, 320);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'woman_earrings')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('woman_earrings', 'Earrings (woman, brush se)', 'Earrings badlo (woman, brush se)', 'Photo do, phir brush se kaan wala hissa laal karo. Prompt mein batao: earring ka design aur rang.', 'image', '["face", "style"]', '[]', '{"face":"Photo (woman)","style":"Mask (brush se kaan wala area)"}', '{"face":"Apni photo","style":"Mask (brush se kaan wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 330);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'woman_nose_pin')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('woman_nose_pin', 'Nose pin / nose ring (woman, brush se)', 'Nose pin badlo (woman, brush se)', 'Photo do, brush se naak wala hissa laal karo. Prompt mein nose pin ka design batao.', 'image', '["face", "style"]', '[]', '{"face":"Photo (woman)","style":"Mask (brush se naak wala area)"}', '{"face":"Apni photo","style":"Mask (brush se naak wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 340);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'woman_shoes')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('woman_shoes', 'Shoes (woman, brush se)', 'Shoes badlo (woman, brush se)', 'Photo do, brush se pair wala hissa laal karo. Prompt mein shoes ka style aur rang batao.', 'image', '["face", "style"]', '[]', '{"face":"Photo (woman)","style":"Mask (brush se pair wala area)"}', '{"face":"Apni photo","style":"Mask (brush se pair wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 350);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'woman_glasses')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('woman_glasses', 'Glasses (woman, brush se)', 'Glasses badlo (woman, brush se)', 'Photo do, brush se aankhon wala hissa laal karo. Prompt mein glasses ka style batao.', 'image', '["face", "style"]', '[]', '{"face":"Photo (woman)","style":"Mask (brush se aankhon wala area)"}', '{"face":"Apni photo","style":"Mask (brush se aankhon wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 360);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'man_glasses')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('man_glasses', 'Glasses (man, brush se)', 'Glasses badlo (man, brush se)', 'Photo do, brush se aankhon wala hissa laal karo. Prompt mein glasses ka style batao.', 'image', '["face", "style"]', '[]', '{"face":"Photo (man)","style":"Mask (brush se aankhon wala area)"}', '{"face":"Apni photo","style":"Mask (brush se aankhon wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 370);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'man_suit')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('man_suit', 'Suit (man, brush se)', 'Suit badlo (man, brush se)', 'Photo do, brush se outfit wala hissa laal karo. Prompt mein suit ka rang aur style batao.', 'image', '["face", "style"]', '[]', '{"face":"Photo (man)","style":"Mask (brush se outfit wala area)"}', '{"face":"Apni photo","style":"Mask (brush se outfit wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 380);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'man_shirt')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('man_shirt', 'Shirt (man, brush se)', 'Shirt badlo (man, brush se)', 'Photo do, brush se shirt wala hissa laal karo. Prompt mein rang aur kapda batao.', 'image', '["face", "style"]', '[]', '{"face":"Photo (man)","style":"Mask (brush se shirt wala area)"}', '{"face":"Apni photo","style":"Mask (brush se shirt wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 390);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'man_jeans')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('man_jeans', 'Jeans (man, brush se)', 'Jeans badlo (man, brush se)', 'Photo do, brush se pant wala hissa laal karo. Prompt mein jeans ka rang aur fit batao.', 'image', '["face", "style"]', '[]', '{"face":"Photo (man)","style":"Mask (brush se pant wala area)"}', '{"face":"Apni photo","style":"Mask (brush se pant wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 400);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'man_shorts')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('man_shorts', 'Shorts (man, brush se)', 'Shorts badlo (man, brush se)', 'Photo do, brush se pant wala hissa laal karo. Prompt mein shorts ka rang aur length batao.', 'image', '["face", "style"]', '[]', '{"face":"Photo (man)","style":"Mask (brush se pant wala area)"}', '{"face":"Apni photo","style":"Mask (brush se pant wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 410);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'man_shoes')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('man_shoes', 'Shoes (man, brush se)', 'Shoes badlo (man, brush se)', 'Photo do, brush se pair wala hissa laal karo. Prompt mein shoes ka style aur rang batao.', 'image', '["face", "style"]', '[]', '{"face":"Photo (man)","style":"Mask (brush se pair wala area)"}', '{"face":"Apni photo","style":"Mask (brush se pair wala area)"}', 0, 1, 0, 1, 0, null, 0, 1, 420);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'pose_change')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, sort)
    VALUES ('pose_change', 'Pose change (front, back, side)', 'Pose badlo (front, back, side)', 'Photo do aur batao kaunsa pose chahiye: front view, back view, side view, walking ya sitting. Chehra aur kapde same rahenge.', 'image', '["face"]', '[]', '{"face":"Person ki photo"}', '{"face":"Apni photo"}', 0, 1, 1, 0, 0, null, 0, 1, 430);
END
GO

IF NOT EXISTS (SELECT 1 FROM ai_studio_task_catalog WHERE task_type = 'per_photo_prompt')
BEGIN
    INSERT INTO ai_studio_task_catalog (task_type, label, customer_label, hint, output, inputs, optional, labels, customer_labels, extras, prompt_required, face_check, edit, transparent, angles, family, customer_visible, per_photo, sort)
    VALUES ('per_photo_prompt', 'Har photo par same prompt (10 tak)', 'Har photo par ek naya result (10 photo tak)',
            'Ek saath 10 photos tak do. Har photo par same prompt chalega aur har photo ka alag result milega.',
            'image', '[]', '[]', '{}', '{"extras":"Photos (10 tak)"}', 1, 1, 0, 0, 0, NULL, 0, 1, 1, 190);
END
GO


IF OBJECT_ID('ai_studio_tool_types', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_tool_types (
        task_type NVARCHAR(100) PRIMARY KEY,
        tool NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES ai_studio_tools(tool) ON UPDATE CASCADE
    );

    -- Chat tool types
    INSERT INTO ai_studio_tool_types (task_type, tool)
    SELECT task_type, 'chat'
    FROM ai_studio_task_catalog
    WHERE task_type IN ('chat', 'photo_read', 'ocr_text', 'product_tag', 'moderation_check');

    -- Image tool types
    INSERT INTO ai_studio_tool_types (task_type, tool)
    SELECT task_type, 'image'
    FROM ai_studio_task_catalog
    WHERE task_type NOT IN ('chat', 'photo_read', 'ocr_text', 'product_tag', 'moderation_check');
END
GO


IF OBJECT_ID('ai_studio_family_roles', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_family_roles (
        role_key NVARCHAR(50) PRIMARY KEY,
        label_admin NVARCHAR(100) NOT NULL,
        label_customer NVARCHAR(100) NOT NULL,
        prompt_text NVARCHAR(MAX) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        enabled BIT NOT NULL DEFAULT 1,
        updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );

    INSERT INTO ai_studio_family_roles (role_key, label_admin, label_customer, prompt_text, sort_order) VALUES
        ('man',         'Aadmi (papa)',    'Aadmi (papa)',    'man',         10),
        ('woman',       'Aurat (mummy)',   'Aurat (mummy)',   'woman',       20),
        ('baby_boy',    'Baby boy',        'Baby boy',        'baby boy',    30),
        ('baby_girl',   'Baby girl',       'Baby girl',       'baby girl',   40),
        ('grandmother', 'Dadi / nani',     'Dadi / nani',     'grandmother', 50),
        ('grandfather', 'Dada / nana',     'Dada / nana',     'grandfather', 60);
END
GO


IF OBJECT_ID('ai_studio_apps', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_apps (
        app_id NVARCHAR(50) PRIMARY KEY,
        label NVARCHAR(100) NOT NULL,
        enabled BIT NOT NULL DEFAULT 1,
        sort INT NOT NULL DEFAULT 0,
        updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );

    INSERT INTO ai_studio_apps (app_id, label, sort) VALUES
        ('weargen', 'WearGen', 10),
        ('ppp', 'PPP', 20);
END
GO


IF OBJECT_ID('ai_studio_app_tasks', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_app_tasks (
        app_id NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES ai_studio_apps(app_id) ON UPDATE CASCADE ON DELETE CASCADE,
        task_type NVARCHAR(100) NOT NULL FOREIGN KEY REFERENCES ai_studio_task_catalog(task_type) ON UPDATE CASCADE ON DELETE CASCADE,
        PRIMARY KEY (app_id, task_type)
    );

    INSERT INTO ai_studio_app_tasks (app_id, task_type)
    SELECT a.app_id, c.task_type
    FROM ai_studio_apps a
    CROSS JOIN ai_studio_task_catalog c;
END
GO


IF OBJECT_ID('ai_studio_prompts', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_prompts (
        task_type NVARCHAR(100) PRIMARY KEY FOREIGN KEY REFERENCES ai_studio_task_catalog(task_type) ON UPDATE CASCADE,
        system_text NVARCHAR(MAX) NOT NULL,
        role_text NVARCHAR(MAX) NOT NULL DEFAULT '',
        negative_text NVARCHAR(MAX) NOT NULL DEFAULT '',
        enabled BIT NOT NULL DEFAULT 1,
        prompt_version INT NOT NULL DEFAULT 1,
        updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
END
GO

-- Seed Task Prompts
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'text_to_image')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('text_to_image', 'Create one photorealistic image that matches the user''s prompt exactly. Natural lighting, real textures, realistic proportions.$s$,
   '''',
   $n$CGI, 3D render, cartoon, anime, painting, illustration, deformed anatomy, extra limbs, distorted hands, text, watermark, signature:1.5$n$, 2),

  (''image_prompt'',
   $s$Create a new photo based on IMAGE 1 and the user''s prompt. Keep the main subject of IMAGE 1 recognisable and realistic.', 'IMAGE 1 = the input photo. Use its subject, composition and colours as the base of the new photo.', 'CGI, 3D render, cartoon, painting, deformed anatomy, extra limbs, distorted hands, text, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'image_to_image')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('image_to_image', 'Keep 100% facial identity from the reference face. Output one realistic photo.', 'IMAGE 1 = face identity to keep exactly. IMAGE 2 = outfit, style and scene to copy.', 'changed face:3.0, altered face:3.0, different face:3.0, face swap:3.0, modified facial features:3.0, new identity:3.0, smooth skin filter:2.0, plastic skin:2.0, beauty filter:2.0, wearing clothes from face reference:2.0, CGI, 3D render, cartoon, anime, deformed face, bad anatomy, extra limbs, missing fingers, mutated hands, text, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'image_to_image_prompt')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('image_to_image_prompt', 'Keep 100% facial identity from the reference face. Output one realistic photo that follows the user''s prompt.', 'IMAGE 1 = face identity to keep exactly. IMAGE 2 = outfit, style and scene to copy.', 'changed face:3.0, altered face:3.0, different face:3.0, face swap:3.0, modified facial features:3.0, new identity:3.0, smooth skin filter:2.0, plastic skin:2.0, beauty filter:2.0, wearing clothes from face reference:2.0, CGI, 3D render, cartoon, anime, deformed face, bad anatomy, extra limbs, missing fingers, mutated hands, text, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'outfit_change')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('outfit_change', 'Dress the person from IMAGE 1 in the outfit from IMAGE 2. The person must stay exactly the same. Output one realistic photo.', 'IMAGE 1 = the person. Keep this exact person unchanged: same face, skin, hair, body, pose, expression and background. IMAGE 2 = the outfit. Copy its colours, fabric, pattern and cut exactly. Change nothing else.', 'changed face:3.0, altered face:3.0, different face:3.0, face swap:3.0, new identity:3.0, original outfit kept:2.5, outfit from wrong reference:2.0, changed pose:2.0, changed background:1.5, smooth skin filter:2.0, plastic skin:2.0, CGI, 3D render, cartoon, deformed body, bad anatomy, extra limbs, missing fingers, mutated hands, text, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'background_change')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('background_change', 'Place the person from IMAGE 1 into the background from IMAGE 2. The person stays exactly the same; only the background changes. Output one realistic photo.', 'IMAGE 1 = the person. Keep this exact person unchanged: same face, skin, hair, body, pose and clothes. IMAGE 2 = the new background. Use its environment, perspective and light, and match the person''s light and shadows to it.', 'changed face:3.0, altered face:3.0, different face:3.0, new identity:3.0, original background kept:2.5, changed outfit:2.5, changed pose:2.0, floating subject:2.0, mismatched lighting:1.8, cut-out edges:2.0, halo around subject:2.0, smooth skin filter:2.0, CGI, 3D render, cartoon, deformed body, bad anatomy, extra limbs, text, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'virtual_tryon')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('virtual_tryon', 'Show the customer from IMAGE 1 wearing or using the product from IMAGE 2. The customer stays exactly the same. Output one realistic photo.', 'IMAGE 1 = the customer. Keep this exact face, body, hair, pose and background. IMAGE 2 = the product (clothing, jewellery or bag). Copy its exact design, colours and shape, and fit it naturally on the customer.', 'changed face:3.0, altered face:3.0, different face:3.0, new identity:3.0, wrong product design:2.5, altered product colour:2.5, product missing:2.0, unnatural product fit:2.0, product floating off the body:2.0, smooth skin filter:2.0, CGI, 3D render, cartoon, deformed body, bad anatomy, extra limbs, missing fingers, mutated hands, text, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'product_scene')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('product_scene', 'Place the EXACT product from IMAGE 1 into a realistic scene described by the user''s prompt. The product must look identical to the reference. Match the scene''s light to the product. Output one realistic photo.', 'IMAGE 1 = the product. Keep its shape, proportions, colours, material, logo, printed text and labels identical. Do not add, remove or redesign any part. If IMAGE 2 is given, use it as the scene reference only.', 'changed logo:3.0, altered text:3.0, wrong colour:2.5, reshaped product:3.0, extra product parts:2.5, cropped product:2.0, product floating unnaturally:2.0, mismatched lighting:1.8, product too small to read:1.5, watermark, text overlay, CGI, 3D render, cartoon, deformed', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'product_catalog')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('product_catalog', 'Clean commercial catalog photograph of the EXACT product from IMAGE 1. The product is the hero. Plain seamless studio background, soft even light, full product visible, sharp focus, true colour. Output one realistic photo.', 'IMAGE 1 = the product. Keep its shape, proportions, colours, material, logo, printed text and labels identical. Do not add, remove or redesign any part.', 'changed logo:3.0, altered text:3.0, wrong colour:2.5, reshaped product:3.0, extra parts:2.5, cropped product:2.0, product partly hidden:2.0, shadows covering product:1.5, background clutter:2.0, props in frame:1.5, watermark, text overlay, CGI, 3D render, deformed', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'project_image')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('project_image', 'Create a new visual that follows the design in IMAGE 1 closely, keeping its layout, colours and key elements. Output one realistic, high-quality image that follows the user''s prompt.', 'IMAGE 1 = the design or project photo. Keep its layout and key elements. If IMAGE 2 is given, use it as the style reference only (colours, mood, texture); do not copy its objects.', 'changed layout:2.5, missing key elements:2.5, added unrelated objects:2.0, altered colours from design:2.0, distorted geometry:2.5, text, watermark, signature:1.5, CGI, 3D render, deformed', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'image_edit')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('image_edit', 'Edit the photo from IMAGE 1 only inside the area marked red in IMAGE 2. Apply the user''s instruction (change colour, add text, remove text) only to that area, so it blends naturally with the rest of the photo. Output one realistic photo.', 'IMAGE 1 = the photo to edit. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changes outside the marked area:3.0, altered face:3.0, changed background:2.5, different lighting outside mask:2.0, visible seam:2.0, blurry edit:2.0, mismatched colours:1.8, extra objects:1.5, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'hair_change')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('hair_change', 'Change ONLY the hair of the person in IMAGE 1, inside the area marked red in IMAGE 2. Apply the hairstyle, colour or length the user describes. Keep the face, skin, expression, body, clothes and background exactly the same. Make the hair look natural, with real strands and correct light.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed face:3.0, altered facial features:3.0, changed skin tone:2.5, changed clothes:2.5, changed background:2.5, changes outside the red area:3.0, unnatural hair edges:2.0, wig look:1.8, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'shirt_change')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('shirt_change', 'Change ONLY the top / shirt of the person in IMAGE 1, inside the area marked red in IMAGE 2, to the colour, fabric and design the user describes. Keep the face, hair, body, pose, trousers and background exactly the same. Keep folds and lighting realistic.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed face:3.0, altered facial features:3.0, changed hair:2.5, changed pose:2.5, changed background:2.5, changed trousers:2.0, changes outside the red area:3.0, flat unrealistic fabric:2.0, wrong fit:1.8, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'suit_change')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('suit_change', 'Change ONLY the outfit of the person in IMAGE 1, inside the area marked red in IMAGE 2, into the suit (jacket and shirt) the user describes. Keep the face, hair, body, pose and background exactly the same. The suit must fit the body and follow the pose, with realistic folds and lighting.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed face:3.0, altered facial features:3.0, changed hair:2.5, changed pose:2.5, changed background:2.5, original casual clothes kept:2.5, changes outside the red area:3.0, wrong fit:2.0, flat unrealistic fabric:2.0, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'bg_change')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('bg_change', 'Replace ONLY the background inside the area marked red in IMAGE 2 with the background the user describes. The person in IMAGE 1 (face, hair, body, pose, clothes) must stay exactly the same. Match the light, perspective and shadows of the person to the new background, and keep the edges around the person clean.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the background only. Do not change any pixel of the person.', 'changed face:3.0, altered person:3.0, changed clothes:2.5, changed pose:2.5, cut-out edges:2.0, halo around subject:2.0, mismatched lighting:1.8, visible seam:2.0, changes outside the red area:3.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'face_swap')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('face_swap', 'Swap the face: put the face of the person in IMAGE 1 onto the person in IMAGE 2. The result must show the same identity as IMAGE 1: same facial features, skin tone and eyes. Keep everything else from IMAGE 2 exactly the same: pose, head angle, body, outfit, hair style, background, lighting and camera. Output one realistic photo.', 'IMAGE 1 = the face to use (identity source). IMAGE 2 = the reference photo: its scene, pose, outfit and background stay exactly the same. Only the face of the person in IMAGE 2 is replaced by the face of IMAGE 1.', 'different person:3.0, identity not matching IMAGE 1:3.0, changed pose:2.5, changed outfit:2.5, changed background:2.5, changed lighting:2.0, two faces:2.0, skin tone mismatch:2.0, smooth skin filter:2.0, plastic skin:2.0, CGI, 3D render, cartoon, deformed face, bad anatomy, text, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'couple_photo')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('couple_photo', 'Create one realistic photo of a couple: the girl from IMAGE 1 and the boy from IMAGE 2, together in the same frame, standing or sitting naturally close to each other. Both keep their exact own identity (face, skin tone, hair, body). Use a relaxed, natural couple pose with correct body proportions, and the same lighting, scale and perspective for both. Output one realistic photo.', 'IMAGE 1 = the girl. Keep her exact face, skin tone, hair and body identical to the photo. IMAGE 2 = the boy. Keep his exact face, skin tone, hair and body identical to the photo. Each person keeps their own outfit from their photo unless the user asks for a change. Never blend or merge the two faces.', 'merged faces:3.0, face swap between the two:3.0, changed face of the girl:3.0, changed face of the boy:3.0, different identity:3.0, extra person:2.5, missing person:2.5, unnatural body contact:2.5, extra limbs:2.5, missing fingers:2.0, mismatched scale:2.0, mismatched lighting:1.8, smooth skin filter:2.0, plastic skin:2.0, CGI, 3D render, cartoon, deformed face, bad anatomy, text, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'family_photo')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('family_photo', 'Create one realistic family photo with every family member from the reference photos in the same frame, standing or sitting together naturally. Each member keeps their exact own identity (face, skin tone, hair, body and apparent age). Natural family pose with correct body proportions, and the same lighting, scale and perspective for everyone. Output one realistic photo.', 'Each IMAGE is one family member. The order of the members is given at the end of the instruction. Keep each person''s face identical to their own photo; never merge or swap faces. Each person keeps their own outfit from their photo unless the user asks for a change. Children stay children, and grandparents stay at their own age.', 'merged faces:3.0, swapped faces:3.0, changed identity:3.0, missing family member:2.5, extra person:2.5, wrong age of a person:2.5, unnatural body contact:2.5, extra limbs:2.5, missing fingers:2.0, mismatched scale:2.0, mismatched lighting:1.8, smooth skin filter:2.0, plastic skin:2.0, CGI, 3D render, cartoon, deformed face, bad anatomy, text, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'outfit_change_ref')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('outfit_change_ref', 'Dress the person from IMAGE 3 (the photo reference) in the outfit from IMAGE 2. The person must look exactly like the person in IMAGE 1 (the face reference): same face, skin tone, hair and body identity. Keep the pose, background, camera and lighting of IMAGE 3 exactly the same. Output one realistic photo.', 'IMAGE 1 = face reference: the identity to keep exactly. IMAGE 2 = outfit: copy its exact colours, fabric, pattern and cut onto the person. IMAGE 3 = photo reference: the base photo. Keep everything in it except the outfit.', 'changed face:3.0, face not matching IMAGE 1:3.0, different identity:3.0, changed pose:2.5, changed background:2.5, changed camera or lighting:2.0, original outfit kept:2.5, outfit from wrong reference:2.0, wrong outfit colours:2.0, smooth skin filter:2.0, plastic skin:2.0, CGI, 3D render, cartoon, deformed body, bad anatomy, extra limbs, missing fingers, mutated hands, text, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'ocr_text')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('ocr_text', 'Read all visible text in IMAGE 1 exactly as it is written, line by line, in the original language and spelling. Keep numbers, prices, dates and symbols exact. If a part is unreadable, write [unreadable] in its place. Output only the text, nothing else.$s$,
   '''', '''', 2),

  (''product_tag'',
   $s$Look at the product in IMAGE 1 and return its tags as plain text, one per line: Category, Main colour, Secondary colours, Material, Pattern, Style, Size (only if visible), Short title (max 12 words). Describe only what is clearly visible. If unsure, write unclear. Output only these lines.$s$,
   '''', '''', 2),

  (''moderation_check'',
   $s$Check IMAGE 1 and return exactly these lines: Blur: yes or no. Brightness: good, too dark or too bright. Subject visible: yes or no. Inappropriate content: yes or no (with the reason if yes). Number of faces: a number. Output only these lines.$s$,
   '''', '''', 2),

  (''poster_text'',
   $s$Design one clean, professional poster or banner. Write the exact text the user gives, with correct spelling, clear readable typography and enough contrast. If IMAGE 1 is given, use it as the main visual and keep the product or person in it unchanged. Output one high-quality design.', 'IMAGE 1 = the main visual to place on the poster (optional). Keep it unchanged; add the text and layout around it.', 'misspelled text:3.0, wrong numbers or prices:3.0, unreadable text:2.5, text cut off:2.0, changed product:2.5, extra random text:2.0, cluttered layout:1.8, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'sticker_logo')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('sticker_logo', 'Create one flat, clean logo or sticker illustration of the user''s description. Place it centred on a solid pure white background (#FFFFFF), with no shadow, no gradient and no border. Crisp edges and bold simple shapes. No text unless the user asks for it.$s$,
   '''',
   $n$shadow:2.0, gradient background:2.5, background texture:2.5, photo realistic background:2.0, cut edges:1.8, blurry edges:2.0, watermark, signature:1.5$n$, 2),

  (''remove_bg'',
   $s$Cut out the main subject of IMAGE 1 exactly as it is. Keep every pixel of the subject unchanged (shape, colour, texture, labels, logo). Place it on a solid pure white background (#FFFFFF) with no shadow and no other objects.', 'IMAGE 1 = the photo. Only the background becomes pure white. The subject must not be altered.', 'altered subject:3.0, changed colour:2.5, missing parts of subject:2.5, background left behind:2.5, shadow:2.0, soft halo around subject:2.0, changed logo or text:3.0, extra objects:2.0', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'restore_photo')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('restore_photo', 'Restore and enhance IMAGE 1: remove noise, scratches, blur and colour fading, and sharpen it into a clean, high-resolution photo. Keep every face identical to the original, with natural skin texture. Keep the composition and everything else unchanged.', 'IMAGE 1 = the old or low quality photo. Keep the same people, pose, clothes and background. Only the quality changes.', 'changed face:3.0, altered facial features:3.0, smooth plastic skin:2.5, added objects:2.0, changed composition:2.5, colour shift:2.0, over-sharpened halos:1.8, watermark, text:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'outpaint')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('outpaint', 'Extend IMAGE 1 to fill the requested aspect ratio. Keep the main subject exactly as it is and continue the background, floor, sky or scenery naturally at the new edges, with matching light, perspective and texture. Do not crop or move the subject.', 'IMAGE 1 = the photo to extend. The original area stays the same; only the new edges are generated.', 'changed subject:3.0, moved subject:2.5, visible seam:2.5, mismatched perspective:2.0, mismatched lighting:2.0, repeated pattern artefacts:1.8, extra objects:1.5, distorted anatomy:2.0, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'style_transfer')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('style_transfer', 'Redraw IMAGE 1 in the art style the user describes (for example sketch, pencil drawing, oil painting, watercolour or cartoon). Keep the composition, the subjects and their positions the same. Apply the style consistently over the whole image.', 'IMAGE 1 = the source image. Keep the same subjects, layout and pose. Only the rendering style changes.', 'changed composition:2.5, missing subjects:2.5, added objects:2.0, inconsistent style:2.0, text, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'mockup')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('mockup', 'Place the design from IMAGE 1 realistically onto the product in IMAGE 2 (t-shirt, mug, bag or similar). Follow the product''s shape, folds, curves and lighting so the design looks printed on it. Keep the product photo otherwise unchanged.', 'IMAGE 1 = the design or artwork (logo or print). Copy it exactly, without changing its colours or text. IMAGE 2 = the product photo: keep its shape, background and lighting.', 'altered design:3.0, misspelled design text:3.0, changed product shape:2.5, design floating above product:2.5, flat unrealistic print:2.0, changed background:2.0, extra objects:1.8, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'product_angles')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('product_angles', 'Create one clean studio photo of the EXACT product from IMAGE 1, shown from the camera angle given at the end of the instruction. The product is the hero: same shape, proportions, colours, material, logo, printed text and labels. Plain seamless studio background, soft even light, full product visible, sharp focus.', 'IMAGE 1 = the product. Do not add, remove or redesign any part. Only the viewing angle changes.', 'changed logo:3.0, altered text:3.0, wrong colour:2.5, reshaped product:3.0, extra parts:2.5, cropped product:2.0, background clutter:2.0, props in frame:1.5, watermark, CGI, 3D render, deformed', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'woman_earrings')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('woman_earrings', 'Add or change ONLY the earrings of the woman in IMAGE 1, inside the red area in IMAGE 2 (the ear area). The earrings must sit naturally on the earlobe, at the same size and height on both ears, and match the light. Keep her face, hair and everything else exactly the same.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed face:3.0, altered facial features:3.0, changed hair:2.5, changed clothes:2.5, changes outside the red area:3.0, uneven earrings:2.0, floating earring:2.0, mismatched lighting:1.8, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'woman_nose_pin')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('woman_nose_pin', 'Add or change ONLY the nose pin or nose ring of the woman in IMAGE 1, inside the red area in IMAGE 2 (the nostril area). It must be small and natural, sitting on the side of the nostril, matching the skin tone and light. Keep her face and everything else exactly the same.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed face:3.0, altered facial features:3.0, oversized nose ring:2.5, nose ring in wrong place:2.5, changed skin tone:2.0, changes outside the red area:3.0, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'woman_shoes')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('woman_shoes', 'Change ONLY the shoes of the woman in IMAGE 1, inside the red area in IMAGE 2 (the feet). Use the style, colour and material the user describes, with correct perspective, size and contact with the ground. Keep her legs, outfit, face and background exactly the same.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed legs:3.0, changed outfit:2.5, changed face:3.0, changes outside the red area:3.0, wrong shoe size:2.0, floating shoes:2.0, wrong perspective:2.0, mismatched lighting:1.8, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'woman_glasses')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('woman_glasses', 'Add or change ONLY the glasses of the woman in IMAGE 1, inside the red area in IMAGE 2 (the eyes area). The glasses must sit correctly on the nose and ears, with the right perspective and realistic reflections. Keep her eyes, face, hair and everything else identical.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed face:3.0, altered eyes:3.0, changed eye colour:2.5, changed hair:2.5, changes outside the red area:3.0, crooked glasses:2.0, glasses floating off the face:2.0, unrealistic reflections:1.8, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'man_glasses')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('man_glasses', 'Add or change ONLY the glasses of the man in IMAGE 1, inside the red area in IMAGE 2 (the eyes area). The glasses must sit correctly on the nose and ears, with the right perspective and realistic reflections. Keep his eyes, face, beard, hair and everything else identical.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed face:3.0, altered eyes:3.0, changed eye colour:2.5, changed beard:2.5, changed hair:2.5, changes outside the red area:3.0, crooked glasses:2.0, glasses floating off the face:2.0, unrealistic reflections:1.8, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'man_suit')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('man_suit', 'Change ONLY the outfit of the man in IMAGE 1, inside the red area in IMAGE 2, into the suit (jacket and trousers) the user describes. The suit must fit his body and follow his pose, with realistic folds and lighting. Keep his face, hair, beard, pose and background exactly the same.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed face:3.0, altered facial features:3.0, changed beard:2.5, changed hair:2.5, changed pose:2.5, changed background:2.5, original casual clothes kept:2.5, changes outside the red area:3.0, wrong fit:2.0, flat unrealistic fabric:2.0, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'man_shirt')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('man_shirt', 'Change ONLY the shirt of the man in IMAGE 1, inside the red area in IMAGE 2, to the colour, fabric and style the user describes. Keep his face, beard, hair, trousers, pose and background exactly the same. Keep folds and lighting realistic.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed face:3.0, altered facial features:3.0, changed beard:2.5, changed hair:2.5, changed pose:2.5, changed trousers:2.0, changes outside the red area:3.0, flat unrealistic fabric:2.0, wrong fit:1.8, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'man_jeans')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('man_jeans', 'Change ONLY the trousers of the man in IMAGE 1, inside the red area in IMAGE 2, into the jeans the user describes. Keep his shirt, shoes, face, beard, pose and background exactly the same. Realistic fit, folds and denim texture.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed face:3.0, altered facial features:3.0, changed shirt:2.5, changed shoes:2.0, changed pose:2.5, changed background:2.5, changes outside the red area:3.0, wrong fit:2.0, plastic denim texture:2.0, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'man_shorts')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('man_shorts', 'Change ONLY the trousers of the man in IMAGE 1, inside the red area in IMAGE 2, into the shorts the user describes. Keep his shirt, shoes, legs, face, beard, pose and background exactly the same. Realistic length, fit and folds.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed face:3.0, altered facial features:3.0, changed shirt:2.5, changed shoes:2.0, changed pose:2.5, changed background:2.5, changes outside the red area:3.0, wrong length:2.0, unnatural legs:2.5, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'man_shoes')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('man_shoes', 'Change ONLY the shoes of the man in IMAGE 1, inside the red area in IMAGE 2 (the feet). Use the style, colour and material the user describes, with correct perspective, size and contact with the ground. Keep his legs, trousers, face and background exactly the same.', 'IMAGE 1 = the photo. IMAGE 2 = mask: the red area is the only area you may change. Everything outside the red area must stay exactly the same.', 'changed legs:3.0, changed trousers:2.5, changed face:3.0, changes outside the red area:3.0, wrong shoe size:2.0, floating shoes:2.0, wrong perspective:2.0, mismatched lighting:1.8, visible seam:2.0, CGI, cartoon, watermark, signature:1.5', 2);
END
GO
IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'pose_change')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('pose_change', 'Change the pose of the person in IMAGE 1 to the pose the user describes (for example front view, back view, side view, walking, sitting, hands in pockets). Keep the same person: identical face, skin tone, hair, body proportions, outfit and colours. Keep the background and lighting. The new pose must be natural and anatomically correct.', 'IMAGE 1 = the person photo. Keep the identity and the outfit exactly; only the body pose and the viewing angle change.', 'changed face:3.0, different identity:3.0, changed outfit:2.5, changed clothes colours:2.5, changed background:2.5, anatomy errors:2.5, extra limbs:2.5, missing fingers:2.0, twisted body:2.0, mismatched lighting:1.8, plastic skin:2.0, CGI, 3D render, cartoon, deformed, watermark, signature:1.5', 2);
END
GO

IF NOT EXISTS (SELECT 1 FROM ai_studio_prompts WHERE task_type = 'per_photo_prompt')
BEGIN
    INSERT INTO ai_studio_prompts (task_type, system_text, role_text, negative_text, prompt_version)
    VALUES ('per_photo_prompt',
            'Apply the user''s prompt to IMAGE 1 and create one realistic, high-quality photo. Keep the main subject of IMAGE 1 recognisable, and keep it unchanged unless the prompt asks for a change. Output one photo.',
            'IMAGE 1 = the input photo for this result.',
            'CGI, 3D render, cartoon, deformed anatomy, extra limbs, distorted hands, text, watermark, signature:1.5',
            2);
END
GO


IF OBJECT_ID('ai_studio_workers', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_workers (
        worker_id NVARCHAR(100) PRIMARY KEY,
        last_seen DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        started_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        paused BIT NOT NULL DEFAULT 0,
        pause_reason NVARCHAR(MAX) NULL,
        drain BIT NOT NULL DEFAULT 0,
        task_limit INT NULL,
        tools NVARCHAR(MAX) NOT NULL DEFAULT '["chat","image"]',
        task_types NVARCHAR(MAX) NULL
    );
END
GO


IF OBJECT_ID('ai_studio_tasks', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_tasks (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        task_type NVARCHAR(100) NOT NULL,
        model NVARCHAR(100) NOT NULL,
        prompt NVARCHAR(MAX) NULL,
        system_text NVARCHAR(MAX) NULL,
        aspect_ratio NVARCHAR(50) NULL,
        image_size NVARCHAR(50) NULL,
        face_image_url NVARCHAR(MAX) NULL,
        style_image_url NVARCHAR(MAX) NULL,
        input_image_url NVARCHAR(MAX) NULL,
        extra_image_urls NVARCHAR(MAX) NULL, -- JSON array
        conversation_id NVARCHAR(255) NULL,
        output_text NVARCHAR(MAX) NULL,
        output_image_url NVARCHAR(MAX) NULL,
        output_image_urls NVARCHAR(MAX) NULL, -- JSON array
        imgbb_image_urls NVARCHAR(MAX) NULL,  -- JSON array
        face_match_score DECIMAL(5,2) NULL,
        user_id NVARCHAR(100) NOT NULL DEFAULT 'weargen_user_1',
        batch_count INT NOT NULL DEFAULT 1,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        error NVARCHAR(MAX) NULL,
        worker_id NVARCHAR(100) NULL,
        tool NVARCHAR(100) NOT NULL DEFAULT 'image',
        app_id NVARCHAR(100) NOT NULL DEFAULT 'weargen',
        attempts INT NOT NULL DEFAULT 0,
        priority INT NOT NULL DEFAULT 0,
        family_role_keys NVARCHAR(MAX) NULL, -- JSON array
        locked_at DATETIMEOFFSET NULL,
        next_run_at DATETIMEOFFSET NULL,
        created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        finished_at DATETIMEOFFSET NULL,
        duration_ms INT NULL,
        process_ms INT NULL
    );

    CREATE NONCLUSTERED INDEX IX_tasks_status ON ai_studio_tasks (status, priority DESC, id ASC);
    CREATE NONCLUSTERED INDEX IX_tasks_worker ON ai_studio_tasks (worker_id, status);
    CREATE NONCLUSTERED INDEX IX_tasks_user ON ai_studio_tasks (user_id, created_at DESC);
END
GO


IF OBJECT_ID('ai_studio_usage', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_usage (
        [day] DATE NOT NULL,
        worker_id NVARCHAR(100) NOT NULL,
        calls INT NOT NULL DEFAULT 0,
        PRIMARY KEY ([day], worker_id)
    );
END
GO


IF OBJECT_ID('ai_studio_admin_log', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_admin_log (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        [at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        admin_id NVARCHAR(100) NULL,
        action NVARCHAR(100) NOT NULL,
        target NVARCHAR(255) NULL,
        details NVARCHAR(MAX) NULL
    );
END
GO


IF OBJECT_ID('ai_studio_alert_log', 'U') IS NULL
BEGIN
    CREATE TABLE ai_studio_alert_log (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        kind NVARCHAR(100) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
END
GO


CREATE OR ALTER VIEW ai_studio_worker_load AS
SELECT 
    w.worker_id,
    w.last_seen,
    SUM(CASE WHEN t.status = 'processing' THEN 1 ELSE 0 END) AS processing,
    SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done,
    w.paused,
    w.drain,
    w.pause_reason,
    w.task_limit
FROM ai_studio_workers w
LEFT JOIN ai_studio_tasks t ON t.worker_id = w.worker_id
GROUP BY w.worker_id, w.last_seen, w.paused, w.drain, w.pause_reason, w.task_limit;
GO


IF NOT EXISTS (SELECT 1 FROM ai_studio_users WHERE email = 'admin@aistudio.com')
BEGIN
    DECLARE @admin_id NVARCHAR(100) = 'admin-user-001';
    INSERT INTO ai_studio_users (id, email, password_hash, role)
    VALUES (@admin_id, 'admin@aistudio.com', 'e86f78a8a3caf0b60d8e74e5942aa6d86dc150cd3c03338aef25b7d2d7e3acc7', 'admin');

    INSERT INTO ai_studio_admins (user_id) VALUES (@admin_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM ai_studio_users WHERE email = 'customer@aistudio.com')
BEGIN
    INSERT INTO ai_studio_users (id, email, password_hash, role)
    VALUES ('customer-user-001', 'customer@aistudio.com', '98ec654a8df28f8f0f8f02220483d46916b85017de0b74d8ec755c28cb8539a8', 'customer');
END
GO
