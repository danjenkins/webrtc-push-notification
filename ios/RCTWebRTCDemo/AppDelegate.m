/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "AppDelegate.h"
#import "RNNotifications.h"
#import <PushKit/PushKit.h>

#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>
#import "RNCallKit.h"

@import UIKit;
// @import Firebase;

// #if defined(__IPHONE_10_0) && __IPHONE_OS_VERSION_MAX_ALLOWED >= __IPHONE_10_0
// @import UserNotifications;
// #endif
//
// // Implement UNUserNotificationCenterDelegate to receive display notification via APNS for devices
// // running iOS 10 and above.
// #if defined(__IPHONE_10_0) && __IPHONE_OS_VERSION_MAX_ALLOWED >= __IPHONE_10_0
// @interface AppDelegate () <UNUserNotificationCenterDelegate>
// @end
// #endif
//
// // Copied from Apple's header in case it is missing in some cases (e.g. pre-Xcode 8 builds).
// #ifndef NSFoundationVersionNumber_iOS_9_x_Max
// #define NSFoundationVersionNumber_iOS_9_x_Max 1299
// #endif


@implementation AppDelegate


- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // [FIRApp configure];
  [self voipRegistration];
  // [START set_messaging_delegate]
  // [FIRMessaging messaging].delegate = self;
  // [END set_messaging_delegate]



  // Register for remote notifications. This shows a permission dialog on first run, to
  // show the dialog at a more appropriate time move this registration accordingly.
  // if (floor(NSFoundationVersionNumber) <= NSFoundationVersionNumber_iOS_7_1) {
  //   // iOS 7.1 or earlier. Disable the deprecation warnings.
  //   #pragma clang diagnostic push
  //   #pragma clang diagnostic ignored "-Wdeprecated-declarations"
  //   UIRemoteNotificationType allNotificationTypes =
  //       (UIRemoteNotificationTypeSound |
  //        UIRemoteNotificationTypeAlert |
  //        UIRemoteNotificationTypeBadge);
  //   [application registerForRemoteNotificationTypes:allNotificationTypes];
  //   #pragma clang diagnostic pop
  // } else {
  //   // iOS 8 or later
  //   // [START register_for_notifications]
  //   if (floor(NSFoundationVersionNumber) <= NSFoundationVersionNumber_iOS_9_x_Max) {
  //     UIUserNotificationType allNotificationTypes =
  //     (UIUserNotificationTypeSound | UIUserNotificationTypeAlert | UIUserNotificationTypeBadge);
  //     UIUserNotificationSettings *settings =
  //     [UIUserNotificationSettings settingsForTypes:allNotificationTypes categories:nil];
  //     [application registerUserNotificationSettings:settings];
  //   } else {
  //     // iOS 10 or later
  //     #if defined(__IPHONE_10_0) && __IPHONE_OS_VERSION_MAX_ALLOWED >= __IPHONE_10_0
  //     // For iOS 10 display notification (sent via APNS)
  //     [UNUserNotificationCenter currentNotificationCenter].delegate = self;
  //     UNAuthorizationOptions authOptions =
  //         UNAuthorizationOptionAlert
  //         | UNAuthorizationOptionSound
  //         | UNAuthorizationOptionBadge;
  //     [[UNUserNotificationCenter currentNotificationCenter] requestAuthorizationWithOptions:authOptions completionHandler:^(BOOL granted, NSError * _Nullable error) {
  //         }];
  //     #endif
  //   }
  //
  //   [application registerForRemoteNotifications];
  //   // [END register_for_notifications]
  // }
  NSURL *jsCodeLocation;

  jsCodeLocation = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index.ios" fallbackResource:nil];

  RCTRootView *rootView = [[RCTRootView alloc] initWithBundleURL:jsCodeLocation
                                                      moduleName:@"RCTWebRTCDemo"
                                               initialProperties:nil
                                                   launchOptions:launchOptions];

  // Initialise RNCallKit
  // RNCallKit *rncallkit = [[RNCallKit alloc] init];
  //
  // // Initialise React Bridge with RNCallKit
  // RCTBridge *bridge = [[RCTBridge alloc] initWithBundleURL:jsCodeLocation
  //                                          moduleProvider:^{ return @[rncallkit]; }
  //                                           launchOptions:launchOptions];
  //
  // // Initialise React Root View with React Bridge you've just created
  // RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge
  //                                                  moduleName:@"RCTWebRTCDemo"
  //                                           initialProperties:nil];
  //
  rootView.backgroundColor = [[UIColor alloc] initWithRed:1.0f green:1.0f blue:1.0f alpha:1];

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  UIViewController *rootViewController = [UIViewController new];
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];
  return YES;
}

// [START refresh_token]
// - (void)messaging:(FIRMessaging *)messaging didReceiveRegistrationToken:(NSString *)fcmToken {
//     NSLog(@"FCM registration token: %@", fcmToken);
//
//     // TODO: If necessary send token to application server.
//     // Note: This callback is fired at each app startup and whenever a new token is generated.
// }
// [END refresh_token]

- (BOOL)application:(UIApplication *)application
continueUserActivity:(NSUserActivity *)userActivity
  restorationHandler:(void(^)(NSArray * __nullable restorableObjects))restorationHandler
{
  return [RNCallKit application:application
           continueUserActivity:userActivity
             restorationHandler:restorationHandler];
}

// Required to register for notifications
- (void)application:(UIApplication *)application didRegisterUserNotificationSettings:(UIUserNotificationSettings *)notificationSettings
{
  [RNNotifications didRegisterUserNotificationSettings:notificationSettings];
}

- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  [RNNotifications didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  [RNNotifications didFailToRegisterForRemoteNotificationsWithError:error];
}

// Required for the notification event.
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)notification {
  [RNNotifications didReceiveRemoteNotification:notification];
}

// Required for the localNotification event.
- (void)application:(UIApplication *)application didReceiveLocalNotification:(UILocalNotification *)notification
{
  [RNNotifications didReceiveLocalNotification:notification];
}


// Register for VoIP notifications
- (void) voipRegistration {
  dispatch_queue_t mainQueue = dispatch_get_main_queue();
  // Create a push registry object
  PKPushRegistry * voipRegistry = [[PKPushRegistry alloc] initWithQueue: mainQueue];
  // Set the registry's delegate to self
  voipRegistry.delegate = self;
  // Set the push type to VoIP
  voipRegistry.desiredPushTypes = [NSSet setWithObject:PKPushTypeVoIP];
//  NSLog(@"voip token: %@", voipRegistry);
}


// PushKit API Support
- (void)pushRegistry:(PKPushRegistry *)registry didUpdatePushCredentials:(PKPushCredentials *)credentials forType:(NSString *)type
{
  [RNNotifications didUpdatePushCredentials:credentials forType:type];
  NSLog(@"voip token: %@", credentials.token);
}

- (void)pushRegistry:(PKPushRegistry *)registry didReceiveIncomingPushWithPayload:(PKPushPayload *)payload forType:(NSString *)type
{
  [RNNotifications didReceiveRemoteNotification:payload.dictionaryPayload];
  NSLog(@"notfication payload: %@", payload.dictionaryPayload);
  //
  // NSDictionary *payloadDict = payload.dictionaryPayload[@"aps"];
  // NSLog(@"didReceiveIncomingPushWithPayload: %@", payloadDict);
  // NSString *message = payloadDict[@"alert"];
  //
  // NSLog(@"%@", message);

  //present a local notifcation to visually see when we are recieving a VoIP Notification
  // if ([[UIApplication sharedApplication] applicationState] == UIApplicationStateBackground) {
  //
  //     UILocalNotification *localNotification = [[UILocalNotification alloc] init];
  //     localNotification.alertBody = message;
  //     localNotification.applicationIconBadgeNumber = 1;
  //     localNotification.soundName = UILocalNotificationDefaultSoundName;
  //
  //     [[UIApplication sharedApplication] presentLocalNotificationNow:localNotification];
  // }
  // else {
  //     dispatch_async(dispatch_get_main_queue(), ^(void){
  //
  //
  //          //deprecated way of doing alerts
  //          UIAlertView *alert = [[UIAlertView alloc] initWithTitle:@"VoIP Notification"
  //                                                         message:message
  //                                                        delegate:nil
  //                                               cancelButtonTitle:@"OK"
  //                                               otherButtonTitles:nil];
  //
  //         [alert show];


          // UIAlertController *alertController = [UIAlertController alertControllerWithTitle:@"VoIP Notification"
          //                                                                          message:message
          //                                                                   preferredStyle:UIAlertControllerStyleAlert];
          // UIAlertAction *actionOk = [UIAlertAction actionWithTitle:@"OK"
          //                                                    style:UIAlertActionStyleDefault
          //                                                  handler:nil];
          // [alertController addAction:actionOk];
//          [self presentAppDelegate:alertController animated:YES completion:nil];

      // });
  // }

}
@end
