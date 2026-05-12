const fs = require('fs');
const path = require('path');

function replaceLinks(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (file !== 'node_modules' && !file.startsWith('.')) {
                replaceLinks(filePath);
            }
        } else if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let original = content;
            
            // Reemplazar href="/login.html" o "/cualquiercosa.html"
            // Pero solo queremos quitar el .html de los links internos
            content = content.replace(/href="\/([^"]+)\.html"/g, 'href="/$1"');
            
            // Reemplazar window.location.href = '/algo.html'
            content = content.replace(/window\.location\.href\s*=\s*['"]\/([^'"]+)\.html['"]/g, 'window.location.href = "/$1"');
            
            if (content !== original) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log('Updated ' + filePath);
            }
        }
    }
}

replaceLinks('.');
console.log('Done.');
