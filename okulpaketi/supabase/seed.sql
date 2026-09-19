-- Ornek/baslangic verisi.
-- Ilk admin kullanicisi Supabase Studio > Authentication > Add user ile olusturulur;
-- ilk kayit olan kullanici trigger sayesinde otomatik 'admin' rolunu alir.

update public.settings
   set template_name       = 'set_teslim_bildirimi',
       template_language   = 'tr',
       send_mode           = 'test',        -- guvenlik: kurulum sonrasi TEST modunda baslar
       test_phone_e164     = null,
       batch_size          = 50,
       throttle_per_second = 15,
       dedupe_window_hours = 24
 where id = true;

-- Var olan bir kullaniciyi admin yapmak icin:
-- update public.profiles set role = 'admin' where email = 'admin@atlaselt.com';
