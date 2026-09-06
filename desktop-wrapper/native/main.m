#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <signal.h>

static NSString *const ProductName = @"柯影智航";

@interface NavigationPolicy : NSObject <WKNavigationDelegate>
@end

@implementation NavigationPolicy

- (void)webView:(WKWebView *)webView
    decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction
                    decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    NSURL *url = navigationAction.request.URL;
    if (url == nil) {
        decisionHandler(WKNavigationActionPolicyCancel);
        return;
    }
    if ([url.host isEqualToString:@"127.0.0.1"] ||
        [url.host isEqualToString:@"localhost"] ||
        [url.scheme isEqualToString:@"about"]) {
        decisionHandler(WKNavigationActionPolicyAllow);
        return;
    }
    if (navigationAction.navigationType == WKNavigationTypeLinkActivated) {
        [NSWorkspace.sharedWorkspace openURL:url];
    }
    decisionHandler(WKNavigationActionPolicyCancel);
}

@end


@interface AppDelegate : NSObject <NSApplicationDelegate>

@property(nonatomic, strong, nullable) NSTask *harness;
@property(nonatomic, strong, nullable) NSWindow *window;
@property(nonatomic, strong) NSMutableString *outputBuffer;
@property(nonatomic, strong) NSMutableString *errorBuffer;
@property(nonatomic, strong) NavigationPolicy *navigationPolicy;

@end


@implementation AppDelegate

- (instancetype)init {
    self = [super init];
    if (self != nil) {
        _outputBuffer = [NSMutableString string];
        _errorBuffer = [NSMutableString string];
        _navigationPolicy = [[NavigationPolicy alloc] init];
    }
    return self;
}

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    [self installMenu];
    [self createWindow];
    [self launchHarness];
    [NSApp activateIgnoringOtherApps:YES];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

- (void)applicationWillTerminate:(NSNotification *)notification {
    [self stopHarness];
}

- (void)installMenu {
    NSMenu *mainMenu = [[NSMenu alloc] init];
    NSMenuItem *appItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:appItem];
    NSMenu *appMenu = [[NSMenu alloc] init];
    [appMenu addItemWithTitle:[@"关于" stringByAppendingString:ProductName]
                       action:@selector(orderFrontStandardAboutPanel:)
                keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:[@"Quit " stringByAppendingString:ProductName]
                       action:@selector(terminate:)
                keyEquivalent:@"q"];
    appItem.submenu = appMenu;

    NSMenuItem *editItem = [[NSMenuItem alloc] initWithTitle:@"编辑"
                                                     action:nil
                                              keyEquivalent:@""];
    NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"编辑"];
    [editMenu addItemWithTitle:@"撤销"
                        action:@selector(undo:)
                 keyEquivalent:@"z"];
    NSMenuItem *redoItem = [editMenu addItemWithTitle:@"重做"
                                              action:@selector(redo:)
                                       keyEquivalent:@"z"];
    redoItem.keyEquivalentModifierMask = NSEventModifierFlagCommand | NSEventModifierFlagShift;
    [editMenu addItem:[NSMenuItem separatorItem]];
    [editMenu addItemWithTitle:@"剪切"
                        action:@selector(cut:)
                 keyEquivalent:@"x"];
    [editMenu addItemWithTitle:@"复制"
                        action:@selector(copy:)
                 keyEquivalent:@"c"];
    [editMenu addItemWithTitle:@"粘贴"
                        action:@selector(paste:)
                 keyEquivalent:@"v"];
    [editMenu addItem:[NSMenuItem separatorItem]];
    [editMenu addItemWithTitle:@"全选"
                        action:@selector(selectAll:)
                 keyEquivalent:@"a"];
    editItem.submenu = editMenu;
    [mainMenu addItem:editItem];

    NSApp.mainMenu = mainMenu;
}

- (void)createWindow {
    WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
    WKWebView *webView = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:configuration];
    webView.navigationDelegate = self.navigationPolicy;
    NSWindowStyleMask mask = NSWindowStyleMaskTitled |
        NSWindowStyleMaskClosable |
        NSWindowStyleMaskMiniaturizable |
        NSWindowStyleMaskResizable;
    NSWindow *window = [[NSWindow alloc]
        initWithContentRect:NSMakeRect(0, 0, 1280, 820)
                  styleMask:mask
                    backing:NSBackingStoreBuffered
                      defer:NO];
    window.title = ProductName;
    [window center];
    window.contentView = webView;
    [window makeKeyAndOrderFront:nil];
    self.window = window;
}

- (void)launchHarness {
    NSURL *resources = NSBundle.mainBundle.resourceURL;
    if (resources == nil) {
        [self fail:@"The application resources directory is missing."];
        return;
    }
    NSURL *node = [resources URLByAppendingPathComponent:@"runtime/node"];
    NSURL *entry = [resources URLByAppendingPathComponent:@"runtime/app/node_modules/@deepseek-ai/dsh/lib/bin.js"];
    for (NSURL *required in @[node, entry]) {
        if (![NSFileManager.defaultManager fileExistsAtPath:required.path]) {
            [self fail:[NSString stringWithFormat:@"The application is incomplete: missing %@.", required.lastPathComponent]];
            return;
        }
    }

    NSURL *supportRoot = [[NSFileManager.defaultManager URLsForDirectory:NSApplicationSupportDirectory
                                                               inDomains:NSUserDomainMask].firstObject
        URLByAppendingPathComponent:@"Koying Pilot"
                         isDirectory:YES];
    NSError *directoryError = nil;
    if (![NSFileManager.defaultManager createDirectoryAtURL:supportRoot
                                withIntermediateDirectories:YES
                                                 attributes:nil
                                                      error:&directoryError]) {
        [self fail:[NSString stringWithFormat:@"Cannot create the application data directory: %@",
            directoryError.localizedDescription]];
        return;
    }

    NSPipe *stdoutPipe = [NSPipe pipe];
    NSPipe *stderrPipe = [NSPipe pipe];
    NSTask *process = [[NSTask alloc] init];
    process.executableURL = node;
    process.arguments = @[entry.path, @"--profile", @"desktop", @"--port", @"0"];
    process.currentDirectoryURL = NSFileManager.defaultManager.homeDirectoryForCurrentUser;
    process.standardOutput = stdoutPipe;
    process.standardError = stderrPipe;

    NSMutableDictionary<NSString *, NSString *> *environment = [NSProcessInfo.processInfo.environment mutableCopy];
    for (NSString *key in environment.allKeys) {
        NSString *upper = key.uppercaseString;
        if ([upper containsString:@"KEY"] || [upper containsString:@"SECRET"] ||
            [upper containsString:@"TOKEN"] || [upper containsString:@"PASSWORD"]) {
            [environment removeObjectForKey:key];
        }
    }
    environment[@"DSH_HOME"] = supportRoot.path;
    environment[@"DSH_TELEMETRY_DISABLED"] = @"1";
    process.environment = environment;

    __weak AppDelegate *weakSelf = self;
    stdoutPipe.fileHandleForReading.readabilityHandler = ^(NSFileHandle *handle) {
        NSData *data = handle.availableData;
        if (data.length == 0) return;
        NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        if (text == nil) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            [weakSelf acceptStandardOutput:text];
        });
    };
    stderrPipe.fileHandleForReading.readabilityHandler = ^(NSFileHandle *handle) {
        NSData *data = handle.availableData;
        if (data.length == 0) return;
        NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        if (text == nil) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            AppDelegate *delegate = weakSelf;
            if (delegate == nil) return;
            [delegate.errorBuffer appendString:text];
            if (delegate.errorBuffer.length > 32768) {
                [delegate.errorBuffer deleteCharactersInRange:NSMakeRange(0, delegate.errorBuffer.length - 32768)];
            }
            NSLog(@"%@", text);
        });
    };
    process.terminationHandler = ^(NSTask *finished) {
        dispatch_async(dispatch_get_main_queue(), ^{
            AppDelegate *delegate = weakSelf;
            if (delegate == nil || delegate.harness != finished) return;
            delegate.harness = nil;
            if (finished.terminationStatus != 0) {
                [delegate fail:[NSString stringWithFormat:@"Harness stopped with status %d.\n\n%@",
                    finished.terminationStatus, delegate.errorBuffer]];
            }
        });
    };

    NSError *launchError = nil;
    if (![process launchAndReturnError:&launchError]) {
        [self fail:[NSString stringWithFormat:@"Cannot start the bundled Harness runtime: %@",
            launchError.localizedDescription]];
        return;
    }
    self.harness = process;
}

- (void)acceptStandardOutput:(NSString *)text {
    [self.outputBuffer appendString:text];
    NSArray<NSString *> *lines = [self.outputBuffer componentsSeparatedByString:@"\n"];
    [self.outputBuffer setString:lines.lastObject ?: @""];
    for (NSUInteger index = 0; index + 1 < lines.count; index += 1) {
        NSString *line = lines[index];
        NSRange marker = [line rangeOfString:@"dsh web: http://127.0.0.1:"];
        if (marker.location == NSNotFound) continue;
        NSUInteger start = marker.location + @"dsh web: ".length;
        NSString *tail = [line substringFromIndex:start];
        NSString *urlText = [tail componentsSeparatedByCharactersInSet:NSCharacterSet.whitespaceCharacterSet].firstObject;
        NSURL *url = [NSURL URLWithString:urlText];
        WKWebView *webView = (WKWebView *)self.window.contentView;
        if (url != nil && [webView isKindOfClass:WKWebView.class]) {
            [webView loadRequest:[NSURLRequest requestWithURL:url]];
        }
    }
}

- (void)stopHarness {
    NSTask *process = self.harness;
    if (process == nil || !process.running) return;
    [process terminate];
    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:5];
    while (process.running && deadline.timeIntervalSinceNow > 0) {
        [NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.05]];
    }
    if (process.running) {
        kill(process.processIdentifier, SIGKILL);
        [process waitUntilExit];
    }
}

- (void)fail:(NSString *)message {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.alertStyle = NSAlertStyleCritical;
    alert.messageText = ProductName;
    alert.informativeText = message;
    [alert runModal];
    [NSApp terminate:nil];
}

@end


int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = NSApplication.sharedApplication;
        AppDelegate *delegate = [[AppDelegate alloc] init];
        application.delegate = delegate;
        [application run];
    }
    return 0;
}
