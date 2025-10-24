/**
 * NOTA: Funcionalidad de PDF DESHABILITADA
 *
 * Este archivo contiene código de generación de PDF que NO se usa actualmente.
 * Los contratos ahora se generan SOLO en formato Word con formato 100% preservado.
 *
 * Las funciones de PDF se mantienen aquí por si se necesitan en el futuro,
 * pero actualmente NO están en uso en la aplicación.
 */

const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const PDFDocument = require('pdfkit');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

class DocumentGenerator {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../uploads');
    this.documentsDir = path.join(this.uploadsDir, 'documents');
    
    // Crear directorios si no existen
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(this.documentsDir)) {
      fs.mkdirSync(this.documentsDir, { recursive: true });
    }
  }

  // Generar documento Word preservando formato original
  async generateWordDocument(contractData) {
    try {
      console.log('📄 Generando documento Word con formato preservado...');
      
      const { contract_number, content, template_name, template_word_path, field_data } = contractData;
      
      // Si tenemos la plantilla Word original, usarla
      if (template_word_path && fs.existsSync(template_word_path)) {
        console.log('📄 Usando plantilla Word original:', template_word_path);
        return await this.generateFromTemplate(template_word_path, contractData);
      }
      
      // Si no hay plantilla Word, crear documento básico
      console.log('⚠️ No hay plantilla Word original, creando documento básico');
      return await this.generateBasicWordDocument(contractData);
      
    } catch (error) {
      console.error('❌ Error generando documento Word:', error);
      throw error;
    }
  }

  // Generar desde plantilla Word original
  async generateFromTemplate(templatePath, contractData) {
    try {
      console.log('📄 Generando desde plantilla Word original...');
      
      const { contract_number, field_data } = contractData;
      
      // Leer la plantilla Word
      const templateBuffer = fs.readFileSync(templatePath);
      const zip = new PizZip(templateBuffer);
      
      // Crear instancia de Docxtemplater
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '{{',
          end: '}}'
        }
      });

      // Preparar datos para reemplazo
      const replacementData = {};
      
      // Si field_data es un Map, convertir a objeto
      if (field_data instanceof Map) {
        field_data.forEach((value, key) => {
          replacementData[key] = value;
        });
      } else if (typeof field_data === 'object') {
        Object.assign(replacementData, field_data);
      }

      console.log('📄 Datos para reemplazo:', replacementData);
      
      // Reemplazar variables en la plantilla
      doc.render(replacementData);
      
      // Generar el documento final
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });
      
      // Guardar archivo
      const fileName = `contrato_${contract_number}_${Date.now()}.docx`;
      const filePath = path.join(this.documentsDir, fileName);
      
      fs.writeFileSync(filePath, buffer);
      
      console.log(`✅ Documento Word generado desde plantilla: ${fileName}`);
      return { filePath, fileName, buffer };
      
    } catch (error) {
      console.error('❌ Error generando desde plantilla:', error);
      throw error;
    }
  }

  // Generar documento Word básico (fallback)
  async generateBasicWordDocument(contractData) {
    try {
      console.log('📄 Generando documento Word básico...');
      
      const { contract_number, content, template_name } = contractData;
      
      // Convertir HTML a texto plano para Word
      const plainText = this.htmlToPlainText(content);
      
      // Crear documento Word
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: `CONTRATO ${contract_number}`,
              heading: HeadingLevel.TITLE,
            }),
            new Paragraph({
              text: `Plantilla: ${template_name}`,
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              text: plainText,
            }),
          ],
        }],
      });

      // Generar buffer
      const buffer = await Packer.toBuffer(doc);
      
      // Guardar archivo
      const fileName = `contrato_${contract_number}_${Date.now()}.docx`;
      const filePath = path.join(this.documentsDir, fileName);
      
      fs.writeFileSync(filePath, buffer);
      
      console.log(`✅ Documento Word básico generado: ${fileName}`);
      return { filePath, fileName, buffer };
      
    } catch (error) {
      console.error('❌ Error generando documento Word básico:', error);
      throw error;
    }
  }

  // Generar documento PDF preservando formato
  async generatePDFDocument(contractData) {
    try {
      console.log('📄 Generando documento PDF con formato preservado...');
      
      const { contract_number, content, template_name, template_word_path, field_data } = contractData;
      
      // Si tenemos la plantilla Word original, usarla para generar PDF
      if (template_word_path && fs.existsSync(template_word_path)) {
        console.log('📄 Generando PDF desde plantilla Word original');
        return await this.generatePDFFromWordTemplate(template_word_path, contractData);
      }
      
      // Si no hay plantilla Word, crear PDF básico
      console.log('⚠️ No hay plantilla Word original, creando PDF básico');
      return await this.generateBasicPDFDocument(contractData);
      
    } catch (error) {
      console.error('❌ Error generando documento PDF:', error);
      throw error;
    }
  }

  // Generar PDF desde plantilla Word original
  async generatePDFFromWordTemplate(templatePath, contractData) {
    try {
      console.log('📄 Generando PDF desde plantilla Word...');
      
      const { contract_number, field_data } = contractData;
      
      // Primero generar el Word con formato preservado
      const wordResult = await this.generateFromTemplate(templatePath, contractData);
      
      // Leer el Word generado y convertir a HTML con formato
      const wordBuffer = fs.readFileSync(wordResult.filePath);
      const result = await mammoth.convertToHtml({ buffer: wordBuffer }, {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em",
          "p[style-name='Normal'] => p:fresh"
        ],
        convertImage: mammoth.images.imgElement(function(image) {
          return image.read("base64").then(function(imageBuffer) {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer
            };
          });
        })
      });
      
      const htmlContent = result.value;
      console.log('📄 HTML generado desde Word:', htmlContent.length, 'caracteres');
      
      // Crear PDF desde HTML
      return await this.generatePDFFromHTML(htmlContent, contractData);
      
    } catch (error) {
      console.error('❌ Error generando PDF desde Word:', error);
      throw error;
    }
  }

  // Generar PDF desde HTML
  async generatePDFFromHTML(htmlContent, contractData) {
    try {
      const { contract_number } = contractData;
      
      // Crear documento PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
      });

      const fileName = `contrato_${contract_number}_${Date.now()}.pdf`;
      const filePath = path.join(this.documentsDir, fileName);
      
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Convertir HTML a texto con mejor formato
      const formattedText = this.htmlToFormattedText(htmlContent);
      
      // Agregar contenido con formato mejorado
      const lines = formattedText.split('\n');
      let isTitle = true;
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          doc.moveDown(0.5);
          return;
        }
        
        if (isTitle && trimmedLine.toUpperCase().includes('CONTRATO')) {
          doc.fontSize(16).text(trimmedLine, { align: 'center' });
          doc.moveDown();
          isTitle = false;
        } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
          // Texto en negrita
          doc.fontSize(12).text(trimmedLine.replace(/\*\*/g, ''), { align: 'left' });
          doc.moveDown(0.5);
        } else {
          doc.fontSize(10).text(trimmedLine, { align: 'justify' });
          doc.moveDown(0.3);
        }
      });

      // Finalizar documento
      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => {
          console.log(`✅ Documento PDF generado desde Word: ${fileName}`);
          resolve({ filePath, fileName });
        });
        stream.on('error', reject);
      });
      
    } catch (error) {
      console.error('❌ Error generando PDF desde HTML:', error);
      throw error;
    }
  }

  // Generar PDF básico (fallback)
  async generateBasicPDFDocument(contractData) {
    try {
      console.log('📄 Generando documento PDF básico...');
      
      const { contract_number, content, template_name } = contractData;
      
      // Convertir HTML a texto plano para PDF
      const plainText = this.htmlToPlainText(content);
      
      // Crear documento PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
      });

      const fileName = `contrato_${contract_number}_${Date.now()}.pdf`;
      const filePath = path.join(this.documentsDir, fileName);
      
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Agregar contenido
      doc.fontSize(16).text(`CONTRATO ${contract_number}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Plantilla: ${template_name}`, { align: 'center' });
      doc.moveDown(2);
      
      // Dividir texto en párrafos
      const paragraphs = plainText.split('\n').filter(p => p.trim());
      paragraphs.forEach(paragraph => {
        doc.fontSize(10).text(paragraph.trim(), { align: 'justify' });
        doc.moveDown();
      });

      // Finalizar documento
      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => {
          console.log(`✅ Documento PDF básico generado: ${fileName}`);
          resolve({ filePath, fileName });
        });
        stream.on('error', reject);
      });
      
    } catch (error) {
      console.error('❌ Error generando documento PDF básico:', error);
      throw error;
    }
  }

  // Convertir HTML a texto plano
  htmlToPlainText(html) {
    if (!html) return '';
    
    return html
      .replace(/<[^>]*>/g, '') // Remover tags HTML
      .replace(/&nbsp;/g, ' ') // Reemplazar espacios no-break
      .replace(/&amp;/g, '&') // Reemplazar entidades HTML
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Normalizar espacios
      .trim();
  }

  // Convertir HTML a texto con formato preservado
  htmlToFormattedText(html) {
    if (!html) return '';
    
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '**$1**\n') // Títulos H1 en negrita
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '**$1**\n') // Títulos H2 en negrita
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '**$1**\n') // Títulos H3 en negrita
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**') // Texto en negrita
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**') // Texto en negrita
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*') // Texto en cursiva
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*') // Texto en cursiva
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n') // Párrafos con doble salto
      .replace(/<br[^>]*>/gi, '\n') // Saltos de línea
      .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n') // Divs con salto
      .replace(/<[^>]*>/g, '') // Remover otros tags HTML
      .replace(/&nbsp;/g, ' ') // Reemplazar espacios no-break
      .replace(/&amp;/g, '&') // Reemplazar entidades HTML
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Normalizar saltos múltiples
      .trim();
  }

  // Generar ambos documentos (Word y PDF)
  async generateDocuments(contractData) {
    try {
      console.log('📄 Generando documentos Word y PDF...');
      
      const [wordResult, pdfResult] = await Promise.all([
        this.generateWordDocument(contractData),
        this.generatePDFDocument(contractData)
      ]);

      return {
        word: wordResult,
        pdf: pdfResult
      };
      
    } catch (error) {
      console.error('❌ Error generando documentos:', error);
      throw error;
    }
  }

  // Limpiar archivos antiguos (opcional)
  async cleanupOldFiles(contractId, keepVersions = 5) {
    try {
      const files = fs.readdirSync(this.documentsDir);
      const contractFiles = files.filter(file => 
        file.includes(`contrato_${contractId}`) || 
        file.includes(`contract_${contractId}`)
      );
      
      if (contractFiles.length > keepVersions) {
        // Ordenar por fecha de modificación y eliminar los más antiguos
        const filesWithStats = contractFiles.map(file => ({
          name: file,
          path: path.join(this.documentsDir, file),
          mtime: fs.statSync(path.join(this.documentsDir, file)).mtime
        }));
        
        filesWithStats
          .sort((a, b) => a.mtime - b.mtime)
          .slice(0, filesWithStats.length - keepVersions)
          .forEach(file => {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Archivo eliminado: ${file.name}`);
          });
      }
    } catch (error) {
      console.error('❌ Error limpiando archivos antiguos:', error);
    }
  }
}

module.exports = DocumentGenerator;
