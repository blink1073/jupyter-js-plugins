// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import {
  IContentsModel
} from 'jupyter-js-services';

import {
  FileBrowserWidget, FileBrowserModel
} from 'jupyter-js-ui/lib/filebrowser';

import {
  FileHandlerRegistry
} from 'jupyter-js-ui/lib/filehandler';

import {
  Application
} from 'phosphide/lib/core/application';

import {
  IChangedArgs
} from 'phosphor-properties';

import {
  Menu, MenuItem
} from 'phosphor-menus';

import {
  TabPanel
} from 'phosphor-tabs';

import {
  Widget
} from 'phosphor-widget';

import {
  JupyterServices
} from '../services/plugin';


/**
 * The default file browser extension.
 */
export
const fileBrowserExtension = {
  id: 'jupyter.extensions.fileBrowser',
  requires: [JupyterServices, FileHandlerRegistry],
  activate: activateFileBrowser
};


/**
 * Activate the file browser.
 */
function activateFileBrowser(app: Application, provider: JupyterServices, registry: FileHandlerRegistry): Promise<void> {
  let contents = provider.contentsManager;
  let sessions = provider.notebookSessionManager;
  let model = new FileBrowserModel(contents, sessions);
  let widget = new FileBrowserWidget(model, registry);
  let menu = createMenu(widget);

  // Add a context menu to the dir listing.
  let node = widget.node.getElementsByClassName('jp-DirListing-content')[0];
  node.addEventListener('contextmenu', (event: MouseEvent) => {
    event.preventDefault();
    let x = event.clientX;
    let y = event.clientY;
    menu.popup(x, y);
  });

  model.fileChanged.connect((mModel, args) => (args: IChangedArgs<string>) => {
    registry.rename(args.oldValue, args.newValue);
  });

  let id = 0;
  registry.opened.connect((r, widget) => {
    if (!widget.id) widget.id = `document-manager-${++id}`;
    if (!widget.isAttached) app.shell.addToMainArea(widget);
    let stack = widget.parent;
    if (!stack) {
      return;
    }
    let tabs = stack.parent;
    if (tabs instanceof TabPanel) {
      tabs.currentWidget = widget;
    }
  });

  // Add the command for a new items.
  let newTextFileId = 'file-operations:new-text-file';
  let newNotebookId = 'file-operations:new-notebook';

  app.commands.add([
    {
      id: newNotebookId,
      handler: () => {
        registry.createNew('notebook', model.path, widget.node).then(contents => {
          registry.open(contents.path);
        });
      }
    },
    {
      id: newTextFileId,
      handler: () => {
        registry.createNew('file', model.path, widget.node).then(contents => {
          registry.open(contents.path);
        });
      }
    }
  ]);


  // Temporary file object focus follower.
  let activeWidget: Widget;
  let widgets: Widget[] = [];
  document.body.addEventListener('focus', event => {
    for (let widget of widgets) {
      let target = event.target as HTMLElement;
      if (widget.isAttached && widget.isVisible) {
        if (widget.node.contains(target)) {
          activeWidget = widget;
          return;
        }
      }
    }
  });

  // Add opened files to the widget list temporarily.
  registry.opened.connect((r, widget) => {
    activeWidget = widget;
    widgets.push(widget);
  });


  // Add the command for saving a document.
  let saveDocumentId = 'file-operations:save';

  app.commands.add([
    {
      id: saveDocumentId,
      handler: () => {
        let path = registry.findPath(activeWidget);
        if (path) registry.save(path);
      }
    }
  ]);
  app.palette.add([
    {
      command: saveDocumentId,
      category: 'File Operations',
      text: 'Save Document',
      caption: 'Save the current document'
    }
  ]);

  // Add the command for reverting a document.
  let revertDocumentId = 'file-operations:revert';

  app.commands.add([
    {
      id: revertDocumentId,
      handler: () => {
        let path = registry.findPath(activeWidget);
        if (path) registry.revert(path);
      }
    }
  ]);
  app.palette.add([
    {
      command: revertDocumentId,
      category: 'File Operations',
      text: 'Revert Document',
      caption: 'Revert the current document'
    }
  ]);

  // Add the command for closing a document.
  let closeDocumentId = 'file-operations:close';

  app.commands.add([
    {
      id: closeDocumentId,
      handler: () => {
        let path = registry.findPath(activeWidget);
        if (path) registry.close(path);
      }
    }
  ]);
  app.palette.add([
    {
      command: closeDocumentId,
      category: 'File Operations',
      text: 'Close Document',
      caption: 'Close the current document'
    }
  ]);

  // Add the command for closing all documents.
  let closeAllId = 'file-operations:close-all';

  app.commands.add([
    {
      id: closeAllId,
      handler: () => {
        registry.closeAll();
      }
    }
  ]);
  app.palette.add([
    {
      command: closeAllId,
      category: 'File Operations',
      text: 'Close All',
      caption: 'Close all open documents'
    }
  ]);

  app.palette.add([
    {
      command: newNotebookId,
      category: 'File Operations',
      text: 'New Notebook',
      caption: 'Create a new Jupyter Notebook'
    },
    {
      command: newTextFileId,
      category: 'File Operations',
      text: 'New Text File',
      caption: 'Create a new text file'
    }
  ]);

  app.commands.add([
    {
      id: 'file-browser:activate',
      handler: showBrowser
    },
    {
      id: 'file-browser:hide',
      handler: hideBrowser
    },
    {
      id: 'file-browser:toggle',
      handler: toggleBrowser
    }
  ]);

  widget.title.text = 'Files';
  widget.id = 'file-browser';
  app.shell.addToLeftArea(widget, { rank: 40 });
  showBrowser();
  return Promise.resolve(void 0);

  function showBrowser(): void {
    app.shell.activateLeft(widget.id);
  }

  function hideBrowser(): void {
    if (!widget.isHidden) app.shell.collapseLeft();
  }

  function toggleBrowser(): void {
    if (widget.isHidden) {
      showBrowser();
    } else {
      hideBrowser();
    }
  }
}


/**
 * Create a context menu for the file browser listing.
 */
function createMenu(fbWidget: FileBrowserWidget):  Menu {
  return new Menu([
    new MenuItem({
      text: '&Open',
      icon: 'fa fa-folder-open-o',
      shortcut: 'Ctrl+O',
      handler: () => { fbWidget.open(); }
    }),
    new MenuItem({
      text: '&Rename',
      icon: 'fa fa-edit',
      shortcut: 'Ctrl+R',
      handler: () => { fbWidget.rename(); }
    }),
    new MenuItem({
      text: '&Delete',
      icon: 'fa fa-remove',
      shortcut: 'Ctrl+D',
      handler: () => { fbWidget.delete(); }
    }),
    new MenuItem({
      text: 'Duplicate',
      icon: 'fa fa-copy',
      handler: () => { fbWidget.duplicate(); }
    }),
    new MenuItem({
      text: 'Cut',
      icon: 'fa fa-cut',
      shortcut: 'Ctrl+X',
      handler: () => { fbWidget.cut(); }
    }),
    new MenuItem({
      text: '&Copy',
      icon: 'fa fa-copy',
      shortcut: 'Ctrl+C',
      handler: () => { fbWidget.copy(); }
    }),
    new MenuItem({
      text: '&Paste',
      icon: 'fa fa-paste',
      shortcut: 'Ctrl+V',
      handler: () => { fbWidget.paste(); }
    }),
    new MenuItem({
      text: 'Download',
      icon: 'fa fa-download',
      handler: () => { fbWidget.download(); }
    }),
    new MenuItem({
      text: 'Shutdown Kernel',
      icon: 'fa fa-stop-circle-o',
      handler: () => { fbWidget.shutdownKernels(); }
    })
  ]);
}
