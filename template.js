const fs = require('fs');
const path = require('path');

/**
 * Simple template helper for Tinny
 * 
 * Provides basic template loading and variable replacement functionality
 * without adding heavy template engine dependencies
 */

class TemplateHelper {
  constructor() {
    this.templateCache = new Map();
    this.templatesDir = path.join(__dirname, 'html');
  }

  /**
   * Load and cache a template file
   */
  loadTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    const templatePath = path.join(this.templatesDir, `${templateName}.html`);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templateName}.html`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    this.templateCache.set(templateName, templateContent);
    
    return templateContent;
  }

  /**
   * Render template with variables
   */
  render(templateName, variables = {}) {
    const template = this.loadTemplate(templateName);
    
    // Simple variable replacement using {{VARIABLE_NAME}} syntax
    let rendered = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), value || '');
    }

    return rendered;
  }

  /**
   * Clear template cache (useful for development)
   */
  clearCache() {
    this.templateCache.clear();
  }
}

// Singleton instance
const templateHelper = new TemplateHelper();

/**
 * Render a template with variables
 */
function renderTemplate(templateName, variables = {}) {
  return templateHelper.render(templateName, variables);
}

/**
 * Clear template cache (for development)
 */
function clearTemplateCache() {
  templateHelper.clearCache();
}

module.exports = {
  renderTemplate,
  clearTemplateCache,
  TemplateHelper
};