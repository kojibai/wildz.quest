// Next's manifests carry ?dpl, but Webpack's new Worker() and importScripts()
// runtimes use chunk filenames directly. Pin both to the opened deployment.
export function deploymentScriptRuntime(deploymentId, scriptUrlGlobal) {
  return `
var wildzDeploymentId = ${JSON.stringify(deploymentId || null)};
if (!wildzDeploymentId && typeof document !== 'undefined') {
  var wildzDeploymentScript = document.querySelector('script[data-deployment-id]');
  wildzDeploymentId = wildzDeploymentScript && wildzDeploymentScript.getAttribute('data-deployment-id');
  if (!wildzDeploymentId) {
    for (var wildzScript of document.scripts) {
      if (!wildzScript.src) continue;
      var wildzScriptUrl = new URL(wildzScript.src, document.baseURI);
      if (wildzScriptUrl.pathname.indexOf('/_next/') !== -1) {
        wildzDeploymentId = wildzScriptUrl.searchParams.get('dpl');
        if (wildzDeploymentId) break;
      }
    }
  }
}
if (!wildzDeploymentId && typeof self !== 'undefined' && self.location) {
  wildzDeploymentId = new URL(self.location.href).searchParams.get('dpl');
}
if (wildzDeploymentId) {
  var wildzCreateScriptUrl = ${scriptUrlGlobal};
  ${scriptUrlGlobal} = function(scriptUrl) {
    var url = new URL(scriptUrl, typeof document !== 'undefined' ? document.baseURI : self.location.href);
    url.searchParams.set('dpl', wildzDeploymentId);
    return wildzCreateScriptUrl(url.href);
  };
}
`;
}

export function workerDeploymentPlugin(webpack, deploymentId) {
  const name = 'WildzWorkerDeploymentPlugin';
  class DeploymentRuntime extends webpack.RuntimeModule {
    constructor() { super('wildz worker deployment', webpack.RuntimeModule.STAGE_ATTACH); }
    generate() { return deploymentScriptRuntime(deploymentId, webpack.RuntimeGlobals.createScriptUrl); }
  }
  return {
    apply(compiler) {
      compiler.hooks.thisCompilation.tap(name, compilation => {
        // Apply after Next encodes chunk filenames, at the actual script URL
        // boundary. Filename queries would otherwise become %3Fdpl%3D.
        compilation.hooks.runtimeRequirementInTree.for(webpack.RuntimeGlobals.createScriptUrl).tap(name, chunk => {
          compilation.addRuntimeModule(chunk, new DeploymentRuntime());
        });
      });
    }
  };
}
