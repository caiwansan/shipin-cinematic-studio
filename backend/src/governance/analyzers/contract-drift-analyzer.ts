import { governanceEngine, Violation, SystemLayer } from '../core/policy-engine.js';
import * as fs from 'fs';
import * as path from 'path';

export class ContractDriftAnalyzer {
  analyzeRoutes(): Violation[] {
    const routesDir = path.resolve('src/routes');
    const violations: Violation[] = [];

    if (!fs.existsSync(routesDir)) return violations;

    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));
    for (const file of routeFiles) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
      const lines = content.split('\n');

      // Check: has success return but no ApiResponse import?
      const hasSuccessReturn = content.includes('success:');
      const hasApiResponseImport = content.includes('ApiResponse') || content.includes('../contracts/api/base');
      const hasSatisfies = content.includes('satisfies ApiResponse');
      
      if (hasSuccessReturn && !hasApiResponseImport) {
        violations.push({
          file: `routes/${file}`,
          line: 1,
          layer: SystemLayer.ROUTE,
          rule: 'missing-contract-import',
          severity: 'LOW',
          message: 'Route returns {success, data} but has no ApiResponse import',
        });
      }

      if (hasSuccessReturn && hasApiResponseImport && !hasSatisfies) {
        violations.push({
          file: `routes/${file}`,
          line: 1,
          layer: SystemLayer.ROUTE,
          rule: 'missing-satisfies',
          severity: 'MEDIUM',
          message: 'Route uses ApiResponse but return lacks satisfies type binding',
        });
      }

      // Detect hybrid pattern (both success returns AND bare domain returns)
      const bareReturns = content.match(/return\s*\{[^}]*\}/g)?.filter(r => !r.includes('success')) || [];
      const successReturns = content.match(/return\s*\{[^}]*success\s*:/g) || [];
      if (bareReturns.length > 0 && successReturns.length > 0) {
        violations.push({
          file: `routes/${file}`,
          line: 1,
          layer: SystemLayer.HYBRID,
          rule: 'hybrid-return-pattern',
          severity: 'HIGH',
          message: `HYBRID: ${successReturns.length} success-wrapped + ${bareReturns.length} bare returns`,
        });
      }
    }

    violations.forEach(v => governanceEngine.report(v));
    return violations;
  }
}
