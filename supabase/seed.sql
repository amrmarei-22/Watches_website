-- seed.sql — SAMPLE data for development only. Delete before production. All products are marked SAMPLE-*.
-- Images point to /placeholders/watch-placeholder.svg (public asset). Replace with real photos via admin panel.
insert into public.products (sku, name_ar, name_en, brand, description_ar, description_en, price, stock, status, featured, specs) values
('SAMPLE-001','كلاسيك 40 ستانلس','Classic 40 Steel','Vintage','ساعة كلاسيكية بحركة أوتوماتيك. (عينة)','Classic automatic watch. (sample)',1250000,10,'ACTIVE',true,'{"caseSize":40,"movement":"automatic","material":"stainless_steel","waterResistance":100,"strap":"steel","gender":"men"}'),
('SAMPLE-002','هيريتدج 38 جلد','Heritage 38 Leather','Vintage','تصميم أنيق بسوار جلد. (عينة)','Elegant design with leather strap. (sample)',980000,2,'ACTIVE',true,'{"caseSize":38,"movement":"automatic","material":"stainless_steel","waterResistance":50,"strap":"leather","gender":"unisex"}'),
('SAMPLE-003','رويال 36 ذهب وردي','Royal 36 Rose Gold','Vintage','ساعة نسائية بإطار ذهب وردي. (عينة)','Ladies watch in rose gold. (sample)',2150000,0,'ACTIVE',false,'{"caseSize":36,"movement":"quartz","material":"rose_gold","waterResistance":30,"strap":"steel","gender":"women"}'),
('SAMPLE-004','أفييتور 42 تيتانيوم','Aviator 42 Titanium','Vintage','خفيفة ومتينة من التيتانيوم. (عينة)','Light and durable titanium. (sample)',1890000,5,'ACTIVE',true,'{"caseSize":42,"movement":"automatic","material":"titanium","waterResistance":200,"strap":"rubber","gender":"men"}'),
('SAMPLE-005','سيراميك 41 أسود','Ceramic 41 Black','Vintage','إطار سيراميك مقاوم للخدوش. (عينة)','Scratch-resistant ceramic case. (sample)',3200000,4,'ACTIVE',true,'{"caseSize":41,"movement":"automatic","material":"ceramic","waterResistance":100,"strap":"rubber","gender":"unisex"}'),
('SAMPLE-006','كوارتز 34 فاخرة','Quartz 34 Dress','Vintage','ساعة رسمية رفيعة. (عينة)','Slim dress watch. (sample)',620000,8,'ACTIVE',false,'{"caseSize":34,"movement":"quartz","material":"gold","waterResistance":30,"strap":"leather","gender":"women"}'),
('SAMPLE-007','مانيوال 39 كلاسيك','Manual 39 Classic','Vintage','حركة يدوية للهواة. (عينة)','Hand-wound movement for enthusiasts. (sample)',1540000,1,'ACTIVE',false,'{"caseSize":39,"movement":"manual","material":"stainless_steel","waterResistance":50,"strap":"leather","gender":"men"}'),
('SAMPLE-008','ديفر 44 ستانلس','Diver 44 Steel','Vintage','مقاومة للماء حتى 300 متر. (عينة)','Water resistant to 300 m. (sample)',2780000,6,'ACTIVE',false,'{"caseSize":44,"movement":"automatic","material":"stainless_steel","waterResistance":300,"strap":"steel","gender":"men"}');

insert into public.product_images (product_id, path, position, is_primary)
select id, '/placeholders/watch-placeholder.svg', 0, true from public.products where sku like 'SAMPLE-%';
