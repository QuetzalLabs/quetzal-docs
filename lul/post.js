const fs = require('fs');
const path = require('path');

const finalize = async (buildPath, kpush) => {
    console.log('[post-script] finalize called');
    console.log('[post-script] buildPath:', buildPath);
    console.log('[post-script] kpush provided:', !!kpush);
    console.log('[post-script] kpush.addFile is function:', !!(kpush && typeof kpush.addFile === 'function'));

    try {
        const docsPath = path.join(buildPath, 'docs.json');
        console.log('[post-script] Loading docs.json from:', docsPath);

        if (!fs.existsSync(docsPath)) {
            console.error('[post-script] docs.json does NOT exist at path:', docsPath);
            console.log('[post-script] Directory contents:', fs.readdirSync(buildPath));
            return;
        }

        const docsContent = fs.readFileSync(docsPath, 'utf8');
        console.log('[post-script] docs.json loaded, length:', docsContent.length);

        const docs = JSON.parse(docsContent);
        console.log('[post-script] docs.json parsed successfully');
        console.log('[post-script] Top-level keys:', Object.keys(docs));

        if (!docs.navigation) {
            console.error('[post-script] BAIL: docs.navigation is missing');
            return;
        }
        console.log('[post-script] navigation keys:', Object.keys(docs.navigation));

        if (!Array.isArray(docs.navigation.languages)) {
            console.error('[post-script] BAIL: docs.navigation.languages is not an array, got:', typeof docs.navigation.languages);
            return;
        }
        console.log('[post-script] Number of languages:', docs.navigation.languages.length);

        const languages = docs.navigation.languages;

        // Log all languages found
        for (const lang of languages) {
            console.log(`[post-script] Found language entry: "${lang.language}", groups: ${Array.isArray(lang.groups) ? lang.groups.length : 'NOT AN ARRAY'}`);
            if (Array.isArray(lang.groups)) {
                for (const g of lang.groups) {
                    console.log(`[post-script]   group: "${g.group}", pages: ${Array.isArray(g.pages) ? g.pages.length : 'NOT AN ARRAY'}`);
                }
            }
        }

        const enLang = languages.find(l => l.language === 'en');

        if (!enLang) {
            console.error('[post-script] BAIL: No language with language === "en" found');
            console.log('[post-script] Available languages:', languages.map(l => l.language));
            return;
        }

        if (!Array.isArray(enLang.groups)) {
            console.error('[post-script] BAIL: en language has no groups array');
            return;
        }

        const enLocale = detectLocale(enLang, 'en');
        console.log('[post-script] Detected en locale prefix:', enLocale);

        // Build and log the full locale mapping
        const localeMap = {};
        for (const lang of languages) {
            const detected = detectLocale(lang, lang.language);
            localeMap[lang.language] = detected;
        }
        console.log('[post-script] Full locale mapping (language -> locale prefix):', JSON.stringify(localeMap, null, 2));

        // Log en's group/page structure as the source of truth
        console.log('[post-script] --- EN structure (source of truth) ---');
        for (const group of enLang.groups) {
            console.log(`[post-script]   group: "${group.group}"`);
            if (Array.isArray(group.pages)) {
                for (const page of group.pages) {
                    console.log(`[post-script]     page: "${page}" (type: ${typeof page})`);
                }
            }
        }

        let languagesUpdated = 0;

        for (const lang of languages) {
            if (lang.language === 'en') continue;

            const targetLocale = localeMap[lang.language];
            console.log(`[post-script] Processing language "${lang.language}" with locale prefix "${targetLocale}"`);
            console.log(`[post-script]   Before: ${Array.isArray(lang.groups) ? lang.groups.length : 0} groups`);

            lang.groups = JSON.parse(JSON.stringify(enLang.groups)).map(group => {
                if (Array.isArray(group.pages)) {
                    group.pages = group.pages.map(page => {
                        if (typeof page === 'string' && page.startsWith(enLocale + '/')) {
                            const newPage = targetLocale + page.substring(enLocale.length);
                            return newPage;
                        }
                        console.warn(`[post-script]   WARNING: page did not match enLocale prefix "${enLocale}/": "${page}" (type: ${typeof page})`);
                        return page;
                    });
                }
                return group;
            });

            console.log(`[post-script]   After: ${lang.groups.length} groups`);
            for (const g of lang.groups) {
                console.log(`[post-script]     group: "${g.group}", pages: [${Array.isArray(g.pages) ? g.pages.map(p => `"${p}"`).join(', ') : 'N/A'}]`);
            }

            languagesUpdated++;
        }

        console.log(`[post-script] Total languages updated: ${languagesUpdated}`);

        const fileContent = JSON.stringify(docs, null, 2);
        console.log('[post-script] Serialized modified docs.json, length:', fileContent.length);
        fs.writeFile('./lulres.json', fileContent, () => (console.log('wtf')))

        console.log('[post-script] Calling kpush.addFile...');
        try {
            //const result = kpush.addFile('docs.json', fileContent, false);
            //console.log('[post-script] kpush.addFile returned:', result);
        } catch (kpushErr) {
            console.error('[post-script] kpush.addFile THREW:', kpushErr);
            console.error('[post-script] kpush.addFile error stack:', kpushErr.stack);
        }

        console.log('[post-script] Done!');
    } catch (e) {
        console.error('[post-script] UNCAUGHT ERROR:', e);
        console.error('[post-script] Error message:', e.message);
        console.error('[post-script] Error stack:', e.stack);
    }
};

function detectLocale(langObj, fallback) {
    if (Array.isArray(langObj.groups)) {
        for (const group of langObj.groups) {
            if (Array.isArray(group.pages)) {
                for (const page of group.pages) {
                    if (typeof page === 'string') {
                        const slashIdx = page.indexOf('/');
                        if (slashIdx > 0) {
                            const locale = page.substring(0, slashIdx);
                            return locale;
                        }
                    }
                }
            }
        }
    }
    console.warn(`[post-script] detectLocale: No locale found in pages for language "${langObj.language}", falling back to "${fallback}"`);
    return fallback;
}

module.exports = { finalize };