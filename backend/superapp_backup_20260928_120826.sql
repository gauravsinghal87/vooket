-- MySQL dump 10.13  Distrib 8.0.44, for macos11.7 (x86_64)
--
-- Host: 127.0.0.1    Database: superapp
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `addon_options`
--

DROP TABLE IF EXISTS `addon_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `addon_options` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `addon_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_available` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `addon_options_addon_id_foreign` (`addon_id`),
  CONSTRAINT `addon_options_addon_id_foreign` FOREIGN KEY (`addon_id`) REFERENCES `addons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `addon_options`
--

LOCK TABLES `addon_options` WRITE;
/*!40000 ALTER TABLE `addon_options` DISABLE KEYS */;
INSERT INTO `addon_options` VALUES (1,1,'Extra Cheese',40.00,0,1,0,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(2,1,'Extra Butter',30.00,0,1,1,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(3,1,'Spicy',0.00,0,1,2,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(4,1,'Extra Spice',20.00,0,1,3,'2026-09-18 04:12:15','2026-09-18 04:12:15');
/*!40000 ALTER TABLE `addon_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `addons`
--

DROP TABLE IF EXISTS `addons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `addons` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'single',
  `vendor_id` bigint unsigned NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `addons_vendor_id_foreign` (`vendor_id`),
  CONSTRAINT `addons_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `addons`
--

LOCK TABLES `addons` WRITE;
/*!40000 ALTER TABLE `addons` DISABLE KEYS */;
INSERT INTO `addons` VALUES (1,'Extra Add-ons','multiple',6,1,'2026-09-18 04:12:15','2026-09-18 04:12:15');
/*!40000 ALTER TABLE `addons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `addresses`
--

DROP TABLE IF EXISTS `addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `addresses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `label` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Other',
  `contact_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line_1` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address_line_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `landmark` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `state` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `place_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `formatted_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'India',
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'delivery',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `addresses_user_id_is_default_index` (`user_id`,`is_default`),
  KEY `addresses_latitude_longitude_index` (`latitude`,`longitude`),
  KEY `addresses_place_id_index` (`place_id`),
  CONSTRAINT `addresses_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `addresses`
--

LOCK TABLES `addresses` WRITE;
/*!40000 ALTER TABLE `addresses` DISABLE KEYS */;
INSERT INTO `addresses` VALUES (1,19,'Home Jaipur','Jaipur Customer','9876511111','54, Sector 5, Malviya Nagar',NULL,'Near Jain Mandir','Jaipur','Rajasthan','302017',NULL,NULL,'India',26.8555000,75.8100000,'delivery',1,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(2,64,'Work',NULL,NULL,'MG Road',NULL,NULL,'Jaipur','Rajasthan','302001',NULL,'Jaipur, Rajasthan, India','India',26.8486527,75.7639273,'delivery',0,NULL,'2026-09-18 06:35:53','2026-09-18 06:36:56',NULL),(3,64,'Home',NULL,NULL,'waplia digital solutions','behind fortis hospital',NULL,'Jaipur','Rajasthan','302001',NULL,'Jaipur, Rajasthan, India','India',26.8457216,75.8047421,'delivery',0,NULL,'2026-09-18 06:36:54','2026-09-23 22:59:05',NULL),(4,64,'Home',NULL,NULL,'Sanganer','near sanganer thana',NULL,'Jaipur Municipal Corporation','Rajasthan','302029','nominatim:node:2188691283','Sanganer, Society Walking Path, Jaipur Municipal Corporation, Sanganer Tehsil, Jaipur, Rajasthan, 302029, India','India',26.8146217,75.7731874,'delivery',0,NULL,'2026-09-21 05:12:24','2026-09-21 05:12:24',NULL),(5,64,'Home',NULL,NULL,'Ajmeri Gate','near yadgar bhawan',NULL,'Jaipur','Rajasthan','302001','nominatim:way:547207098','Ajmeri Gate, Kishanpole Bazar Road, Ramganj, Jaipur, Jaipur Municipal Corporation, Jaipur Tehsil, Jaipur, Rajasthan, 302001, India','India',26.9172212,75.8168184,'delivery',1,NULL,'2026-09-23 22:59:01','2026-09-23 22:59:05',NULL);
/*!40000 ALTER TABLE `addresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'string',
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `options` json DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `app_settings_key_unique` (`key`),
  KEY `app_settings_group_index` (`group`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_settings`
--

LOCK TABLES `app_settings` WRITE;
/*!40000 ALTER TABLE `app_settings` DISABLE KEYS */;
INSERT INTO `app_settings` VALUES (1,'general','platform_name','Platform Name','SuperApp','string',1,NULL,1,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(2,'general','currency','Currency','INR','string',1,NULL,2,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(3,'general','support_phone','Support Phone','+91 98765 43210','string',1,NULL,3,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(4,'general','support_email','Support Email','support@superapp.com','string',1,NULL,4,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(5,'wallet','min_topup_amount','Min Topup Amount','100','number',0,NULL,1,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(6,'wallet','max_topup_amount','Max Topup Amount','10000','number',0,NULL,2,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(7,'commission','food_commission','Food Commission %','15','number',0,NULL,1,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(8,'commission','grocery_commission','Grocery Commission %','10','number',0,NULL,2,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(9,'commission','ride_commission','Ride Commission %','15','number',0,NULL,3,'2026-09-18 04:12:14','2026-09-23 05:06:39'),(10,'payment','cash_on_delivery_enabled','Cash on Delivery','true','boolean',1,NULL,1,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(11,'payment','wallet_payments_enabled','Wallet Payments','true','boolean',1,NULL,2,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(12,'payment','online_payments_enabled','Online Payments','true','boolean',1,NULL,3,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(16,'ride','surge_pricing_enabled','Surge Pricing','false','boolean',1,NULL,1,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(17,'ride','driver_search_timeout_sec','Driver Search Timeout (sec)','30','number',0,NULL,2,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(18,'loyalty','points_per_rupee','Loyalty Points per Rupee','1','number',0,NULL,1,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(19,'loyalty','points_redeem_rate','Points Redeem Rate (1 point = ₹)','0.05','number',0,NULL,2,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(34,'food_delivery','food_delivery_fee_per_km','Delivery Fee per KM','5','number',1,NULL,2,'2026-09-21 06:16:21','2026-09-27 23:06:44'),(35,'food_delivery','food_free_delivery_above','Free Delivery Above','500','number',1,NULL,4,'2026-09-21 06:16:21','2026-09-27 23:06:57'),(36,'food_delivery','food_delivery_gst_percent','Delivery GST %','18','number',1,NULL,5,'2026-09-21 06:16:21','2026-09-27 23:06:57'),(38,'grocery_delivery','grocery_delivery_fee_per_km','Delivery Fee per KM','5','number',1,NULL,2,'2026-09-21 06:16:21','2026-09-27 23:06:44'),(39,'grocery_delivery','grocery_free_delivery_above','Free Delivery Above','500','number',1,NULL,4,'2026-09-21 06:16:21','2026-09-27 23:06:57'),(40,'grocery_delivery','grocery_delivery_gst_percent','Delivery GST %','18','number',1,NULL,5,'2026-09-21 06:16:21','2026-09-27 23:06:57'),(41,'grocery_delivery','grocery_free_delivery_km','Free Delivery Within (KM)','2','number',1,NULL,6,'2026-09-21 06:25:21','2026-09-27 23:06:57'),(42,'partner_delivery','food_partner_base_fee','Food Partner Base Fee','30','number',0,NULL,1,NULL,NULL),(43,'partner_delivery','food_delivery_partner_fee_per_km','Food Partner Fee per KM','5','number',0,NULL,2,NULL,NULL),(44,'food_delivery','food_free_delivery_km','Free Delivery Within (KM)','2','number',1,NULL,6,'2026-09-27 22:22:51','2026-09-27 23:06:57'),(48,'food_delivery','food_delivery_fee_paid_by_admin_per_km','Delivery Fee Paid by Admin per KM','11','number',1,NULL,3,'2026-09-27 23:06:57','2026-09-27 23:17:17'),(49,'grocery_delivery','grocery_delivery_fee_paid_by_admin_per_km','Delivery Fee Paid by Admin per KM','11','number',1,NULL,3,'2026-09-27 23:06:57','2026-09-27 23:17:21');
/*!40000 ALTER TABLE `app_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `role` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint unsigned DEFAULT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `level` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `audit_logs_entity_type_entity_id_index` (`entity_type`,`entity_id`),
  KEY `audit_logs_user_id_created_at_index` (`user_id`,`created_at`),
  KEY `audit_logs_action_index` (`action`),
  CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `banners`
--

DROP TABLE IF EXISTS `banners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `banners` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subtitle` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'home',
  `target_id` bigint unsigned DEFAULT NULL,
  `target_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `starts_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `banners`
--

LOCK TABLES `banners` WRITE;
/*!40000 ALTER TABLE `banners` DISABLE KEYS */;
/*!40000 ALTER TABLE `banners` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `brands`
--

DROP TABLE IF EXISTS `brands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `brands` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `brands`
--

LOCK TABLES `brands` WRITE;
/*!40000 ALTER TABLE `brands` DISABLE KEYS */;
INSERT INTO `brands` VALUES (1,'Amul',NULL,NULL,1,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(2,'Nestle',NULL,NULL,1,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(3,'Tata',NULL,NULL,1,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(4,'Hindustan Unilever',NULL,NULL,1,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(5,'Britannia',NULL,NULL,1,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(6,'Fortune',NULL,NULL,1,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(7,'Aashirvaad',NULL,NULL,1,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(8,'Surf Excel',NULL,NULL,1,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(9,'Colgate',NULL,NULL,1,'2026-09-18 04:12:15','2026-09-18 04:12:15');
/*!40000 ALTER TABLE `brands` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
INSERT INTO `cache` VALUES ('superapp-cache-2874ffbdc2987684d5da2a3236e447b9','i:1;',1790577232),('superapp-cache-2874ffbdc2987684d5da2a3236e447b9:timer','i:1790577232;',1790577232),('superapp-cache-2e2f9cf6d4c9e71eb3431df0536e3e61','i:2;',1790577442),('superapp-cache-2e2f9cf6d4c9e71eb3431df0536e3e61:timer','i:1790577442;',1790577442),('superapp-cache-cfe9e34a06414fb6878dfd371cc35eae','i:1;',1790577531),('superapp-cache-cfe9e34a06414fb6878dfd371cc35eae:timer','i:1790577531;',1790577531),('superapp-cache-f51fc8940096323a37fc779d1097a15b','i:1;',1790577234),('superapp-cache-f51fc8940096323a37fc779d1097a15b:timer','i:1790577234;',1790577234),('superapp-cache-integration:config:ai','a:13:{s:7:\"service\";s:2:\"ai\";s:5:\"label\";s:9:\"Gemini AI\";s:8:\"provider\";s:4:\"mock\";s:19:\"configured_provider\";s:6:\"gemini\";s:11:\"environment\";s:4:\"mock\";s:4:\"mode\";s:4:\"test\";s:7:\"enabled\";b:1;s:13:\"is_configured\";b:0;s:11:\"credentials\";a:0:{}s:8:\"settings\";a:0:{}s:11:\"public_keys\";a:0:{}s:7:\"reasons\";a:1:{i:0;s:26:\"API Key is not configured.\";}s:4:\"from\";s:3:\"env\";}',1790577562),('superapp-cache-integration:config:analytics','a:13:{s:7:\"service\";s:9:\"analytics\";s:5:\"label\";s:9:\"Analytics\";s:8:\"provider\";s:4:\"null\";s:19:\"configured_provider\";s:7:\"posthog\";s:11:\"environment\";s:4:\"mock\";s:4:\"mode\";s:4:\"test\";s:7:\"enabled\";b:1;s:13:\"is_configured\";b:0;s:11:\"credentials\";a:0:{}s:8:\"settings\";a:0:{}s:11:\"public_keys\";a:1:{i:0;s:3:\"key\";}s:7:\"reasons\";a:1:{i:0;s:36:\"Project / API key is not configured.\";}s:4:\"from\";s:3:\"env\";}',1790577562),('superapp-cache-integration:config:captcha','a:13:{s:7:\"service\";s:7:\"captcha\";s:5:\"label\";s:20:\"Cloudflare Turnstile\";s:8:\"provider\";s:4:\"null\";s:19:\"configured_provider\";s:9:\"turnstile\";s:11:\"environment\";s:4:\"mock\";s:4:\"mode\";s:4:\"test\";s:7:\"enabled\";b:1;s:13:\"is_configured\";b:0;s:11:\"credentials\";a:0:{}s:8:\"settings\";a:0:{}s:11:\"public_keys\";a:1:{i:0;s:8:\"site_key\";}s:7:\"reasons\";a:1:{i:0;s:27:\"Site Key is not configured.\";}s:4:\"from\";s:3:\"env\";}',1790577562),('superapp-cache-integration:config:google_oauth','a:13:{s:7:\"service\";s:12:\"google_oauth\";s:5:\"label\";s:12:\"Google OAuth\";s:8:\"provider\";s:6:\"google\";s:19:\"configured_provider\";s:6:\"google\";s:11:\"environment\";s:4:\"live\";s:4:\"mode\";s:4:\"test\";s:7:\"enabled\";b:1;s:13:\"is_configured\";b:1;s:11:\"credentials\";a:2:{s:9:\"client_id\";s:72:\"183311892884-7d5ig0adlq59kg0nap0e1lkiklspssp1.apps.googleusercontent.com\";s:13:\"client_secret\";s:35:\"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\";}s:8:\"settings\";a:0:{}s:11:\"public_keys\";a:1:{i:0;s:9:\"client_id\";}s:7:\"reasons\";a:0:{}s:4:\"from\";s:8:\"database\";}',1790577562),('superapp-cache-integration:config:maps','a:13:{s:7:\"service\";s:4:\"maps\";s:5:\"label\";s:11:\"Google Maps\";s:8:\"provider\";s:6:\"google\";s:19:\"configured_provider\";s:6:\"google\";s:11:\"environment\";s:4:\"live\";s:4:\"mode\";s:4:\"test\";s:7:\"enabled\";b:1;s:13:\"is_configured\";b:1;s:11:\"credentials\";a:2:{s:10:\"server_key\";s:39:\"AIzaSyA7nMh3xeUIjFqvlC7a9DPix-pCocyBRbY\";s:11:\"browser_key\";s:39:\"AIzaSyA7nMh3xeUIjFqvlC7a9DPix-pCocyBRbY\";}s:8:\"settings\";a:0:{}s:11:\"public_keys\";a:1:{i:0;s:11:\"browser_key\";}s:7:\"reasons\";a:0:{}s:4:\"from\";s:8:\"database\";}',1790577562),('superapp-cache-integration:config:media','a:13:{s:7:\"service\";s:5:\"media\";s:5:\"label\";s:13:\"Media Storage\";s:8:\"provider\";s:5:\"local\";s:19:\"configured_provider\";s:10:\"cloudinary\";s:11:\"environment\";s:4:\"mock\";s:4:\"mode\";s:4:\"test\";s:7:\"enabled\";b:1;s:13:\"is_configured\";b:0;s:11:\"credentials\";a:0:{}s:8:\"settings\";a:0:{}s:11:\"public_keys\";a:1:{i:0;s:10:\"cloud_name\";}s:7:\"reasons\";a:1:{i:0;s:29:\"Cloud Name is not configured.\";}s:4:\"from\";s:3:\"env\";}',1790577562),('superapp-cache-integration:config:otp','a:13:{s:7:\"service\";s:3:\"otp\";s:5:\"label\";s:15:\"MSG91 OTP / SMS\";s:8:\"provider\";s:4:\"mock\";s:19:\"configured_provider\";s:5:\"msg91\";s:11:\"environment\";s:4:\"mock\";s:4:\"mode\";s:4:\"test\";s:7:\"enabled\";b:1;s:13:\"is_configured\";b:0;s:11:\"credentials\";a:0:{}s:8:\"settings\";a:0:{}s:11:\"public_keys\";a:0:{}s:7:\"reasons\";a:1:{i:0;s:27:\"Auth Key is not configured.\";}s:4:\"from\";s:3:\"env\";}',1790577562),('superapp-cache-integration:config:payments','a:13:{s:7:\"service\";s:8:\"payments\";s:5:\"label\";s:8:\"Razorpay\";s:8:\"provider\";s:8:\"razorpay\";s:19:\"configured_provider\";s:8:\"razorpay\";s:11:\"environment\";s:4:\"test\";s:4:\"mode\";s:4:\"test\";s:7:\"enabled\";b:1;s:13:\"is_configured\";b:1;s:11:\"credentials\";a:2:{s:6:\"key_id\";s:23:\"rzp_test_Tf4FV060LhPZ9s\";s:10:\"key_secret\";s:24:\"Ftp8p4oogAN07W00FYZX3tYk\";}s:8:\"settings\";a:0:{}s:11:\"public_keys\";a:1:{i:0;s:6:\"key_id\";}s:7:\"reasons\";a:0:{}s:4:\"from\";s:8:\"database\";}',1790577562),('superapp-cache-integration:config:realtime','a:13:{s:7:\"service\";s:8:\"realtime\";s:5:\"label\";s:25:\"Realtime (Laravel Reverb)\";s:8:\"provider\";s:6:\"reverb\";s:19:\"configured_provider\";s:6:\"reverb\";s:11:\"environment\";s:4:\"mock\";s:4:\"mode\";s:4:\"test\";s:7:\"enabled\";b:1;s:13:\"is_configured\";b:0;s:11:\"credentials\";a:0:{}s:8:\"settings\";a:0:{}s:11:\"public_keys\";a:5:{i:0;s:3:\"key\";i:1;s:4:\"host\";i:2;s:4:\"port\";i:3;s:6:\"scheme\";i:4;s:7:\"cluster\";}s:7:\"reasons\";a:0:{}s:4:\"from\";s:3:\"env\";}',1790577560),('superapp-cache-integration:config:search','a:13:{s:7:\"service\";s:6:\"search\";s:5:\"label\";s:6:\"Search\";s:8:\"provider\";s:5:\"mysql\";s:19:\"configured_provider\";s:5:\"mysql\";s:11:\"environment\";s:4:\"mock\";s:4:\"mode\";s:4:\"test\";s:7:\"enabled\";b:1;s:13:\"is_configured\";b:0;s:11:\"credentials\";a:0:{}s:8:\"settings\";a:0:{}s:11:\"public_keys\";a:0:{}s:7:\"reasons\";a:0:{}s:4:\"from\";s:3:\"env\";}',1790577395),('superapp-cache-integration:config:webhook','a:13:{s:7:\"service\";s:7:\"webhook\";s:5:\"label\";s:17:\"Outbound Webhooks\";s:8:\"provider\";s:8:\"outbound\";s:19:\"configured_provider\";s:8:\"outbound\";s:11:\"environment\";s:4:\"mock\";s:4:\"mode\";s:4:\"test\";s:7:\"enabled\";b:1;s:13:\"is_configured\";b:0;s:11:\"credentials\";a:0:{}s:8:\"settings\";a:0:{}s:11:\"public_keys\";a:0:{}s:7:\"reasons\";a:0:{}s:4:\"from\";s:3:\"env\";}',1790577771);
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `campaigns`
--

DROP TABLE IF EXISTS `campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaigns` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_audience` json DEFAULT NULL,
  `content` json DEFAULT NULL,
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `sent_at` timestamp NULL DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `stats` json DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `campaigns_created_by_foreign` (`created_by`),
  CONSTRAINT `campaigns_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaigns`
--

LOCK TABLES `campaigns` WRITE;
/*!40000 ALTER TABLE `campaigns` DISABLE KEYS */;
/*!40000 ALTER TABLE `campaigns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cart_items`
--

DROP TABLE IF EXISTS `cart_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cart_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `cart_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `product_variant_id` bigint unsigned DEFAULT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `quantity` int unsigned NOT NULL,
  `line_total` decimal(10,2) NOT NULL,
  `selected_options` json DEFAULT NULL,
  `selected_addons` json DEFAULT NULL,
  `special_instructions` text COLLATE utf8mb4_unicode_ci,
  `line_signature` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cart_items_product_id_foreign` (`product_id`),
  KEY `cart_items_product_variant_id_foreign` (`product_variant_id`),
  KEY `cart_items_cart_id_product_id_index` (`cart_id`,`product_id`),
  KEY `cart_line_identity` (`cart_id`,`product_id`,`product_variant_id`,`line_signature`),
  CONSTRAINT `cart_items_cart_id_foreign` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cart_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cart_items_product_variant_id_foreign` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cart_items`
--

LOCK TABLES `cart_items` WRITE;
/*!40000 ALTER TABLE `cart_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `cart_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `carts`
--

DROP TABLE IF EXISTS `carts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `carts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `session_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cart_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'food',
  `vendor_id` bigint unsigned DEFAULT NULL,
  `address_id` bigint unsigned DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tax` decimal(10,2) NOT NULL DEFAULT '0.00',
  `delivery_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `delivery_gst_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `delivery_gst_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `coupon_code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `items_count` tinyint NOT NULL DEFAULT '0',
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `carts_vendor_id_foreign` (`vendor_id`),
  KEY `carts_user_id_cart_type_index` (`user_id`,`cart_type`),
  KEY `carts_address_id_foreign` (`address_id`),
  CONSTRAINT `carts_address_id_foreign` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `carts_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `carts_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `carts`
--

LOCK TABLES `carts` WRITE;
/*!40000 ALTER TABLE `carts` DISABLE KEYS */;
/*!40000 ALTER TABLE `carts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'food',
  `icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `meta` json DEFAULT NULL,
  `meta_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta_description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_slug_unique` (`slug`),
  KEY `categories_type_is_active_index` (`type`,`is_active`),
  KEY `categories_parent_id_index` (`parent_id`),
  KEY `categories_sort_order_index` (`sort_order`),
  KEY `categories_type_is_featured_index` (`type`,`is_featured`),
  CONSTRAINT `categories_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'Starters','starters',NULL,'food',NULL,'https://picsum.photos/seed/cat-starters/400/300',NULL,0,1,0,NULL,'Starters - Order Online','Browse and order from Starters near you.','2026-09-18 04:12:14','2026-09-18 04:12:16',NULL),(2,'Paneer Starters','food-paneer-starters',1,'food',NULL,'https://picsum.photos/seed/cat-food-paneer-starters/400/300',NULL,1,1,0,NULL,'Paneer Starters - Order Online','Browse and order from Paneer Starters near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(3,'Chicken Starters','food-chicken-starters',1,'food',NULL,'https://picsum.photos/seed/cat-food-chicken-starters/400/300',NULL,2,1,0,NULL,'Chicken Starters - Order Online','Browse and order from Chicken Starters near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(4,'Soups & Salads','food-soups-salads',1,'food',NULL,'https://picsum.photos/seed/cat-food-soups-salads/400/300',NULL,3,1,0,NULL,'Soups & Salads - Order Online','Browse and order from Soups & Salads near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(5,'Main Course','main-course',NULL,'food',NULL,'https://picsum.photos/seed/cat-main-course/400/300',NULL,0,1,0,NULL,'Main Course - Order Online','Browse and order from Main Course near you.','2026-09-18 04:12:14','2026-09-18 04:12:16',NULL),(6,'Veg Curries','food-veg-curries',5,'food',NULL,'https://picsum.photos/seed/cat-food-veg-curries/400/300',NULL,1,1,0,NULL,'Veg Curries - Order Online','Browse and order from Veg Curries near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(7,'Non-Veg Curries','food-non-veg-curries',5,'food',NULL,'https://picsum.photos/seed/cat-food-non-veg-curries/400/300',NULL,2,1,0,NULL,'Non-Veg Curries - Order Online','Browse and order from Non-Veg Curries near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(8,'Rice & Dal','food-rice-dal',5,'food',NULL,'https://picsum.photos/seed/cat-food-rice-dal/400/300',NULL,3,1,0,NULL,'Rice & Dal - Order Online','Browse and order from Rice & Dal near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(9,'Biryani','biryani',NULL,'food',NULL,'https://picsum.photos/seed/cat-biryani/400/300',NULL,3,1,1,NULL,'Biryani - Order Online','Browse and order from Biryani near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(10,'Veg Biryani','food-veg-biryani',9,'food',NULL,'https://picsum.photos/seed/cat-food-veg-biryani/400/300',NULL,1,1,0,NULL,'Veg Biryani - Order Online','Browse and order from Veg Biryani near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(11,'Chicken Biryani','food-chicken-biryani',9,'food',NULL,'https://picsum.photos/seed/cat-food-chicken-biryani/400/300',NULL,2,1,0,NULL,'Chicken Biryani - Order Online','Browse and order from Chicken Biryani near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(12,'Mutton Biryani','food-mutton-biryani',9,'food',NULL,'https://picsum.photos/seed/cat-food-mutton-biryani/400/300',NULL,3,1,0,NULL,'Mutton Biryani - Order Online','Browse and order from Mutton Biryani near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(13,'Breads','breads',NULL,'food',NULL,'https://picsum.photos/seed/cat-breads/400/300',NULL,0,1,0,NULL,'Breads - Order Online','Browse and order from Breads near you.','2026-09-18 04:12:14','2026-09-18 04:12:16',NULL),(14,'Naan & Roti','food-naan-roti',13,'food',NULL,'https://picsum.photos/seed/cat-food-naan-roti/400/300',NULL,1,1,0,NULL,'Naan & Roti - Order Online','Browse and order from Naan & Roti near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(15,'Paratha','food-paratha',13,'food',NULL,'https://picsum.photos/seed/cat-food-paratha/400/300',NULL,2,1,0,NULL,'Paratha - Order Online','Browse and order from Paratha near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(16,'Desserts','desserts',NULL,'food',NULL,'https://picsum.photos/seed/cat-desserts/400/300',NULL,0,1,0,NULL,'Desserts - Order Online','Browse and order from Desserts near you.','2026-09-18 04:12:14','2026-09-18 04:12:16',NULL),(17,'Ice Cream','food-ice-cream',16,'food',NULL,'https://picsum.photos/seed/cat-food-ice-cream/400/300',NULL,1,1,0,NULL,'Ice Cream - Order Online','Browse and order from Ice Cream near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(18,'Cakes & Pastries','food-cakes-pastries',16,'food',NULL,'https://picsum.photos/seed/cat-food-cakes-pastries/400/300',NULL,2,1,0,NULL,'Cakes & Pastries - Order Online','Browse and order from Cakes & Pastries near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(19,'Traditional Sweets','food-traditional-sweets',16,'food',NULL,'https://picsum.photos/seed/cat-food-traditional-sweets/400/300',NULL,3,1,0,NULL,'Traditional Sweets - Order Online','Browse and order from Traditional Sweets near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(20,'Beverages','beverages',NULL,'food',NULL,'https://picsum.photos/seed/cat-beverages/400/300',NULL,0,1,1,NULL,'Beverages - Order Online','Browse and order from Beverages near you.','2026-09-18 04:12:14','2026-09-18 04:12:16',NULL),(21,'Hot Beverages','food-hot-beverages',20,'food',NULL,'https://picsum.photos/seed/cat-food-hot-beverages/400/300',NULL,1,1,0,NULL,'Hot Beverages - Order Online','Browse and order from Hot Beverages near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(22,'Cold Beverages','food-cold-beverages',20,'food',NULL,'https://picsum.photos/seed/cat-food-cold-beverages/400/300',NULL,2,1,0,NULL,'Cold Beverages - Order Online','Browse and order from Cold Beverages near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(23,'Shakes & Juices','food-shakes-juices',20,'food',NULL,'https://picsum.photos/seed/cat-food-shakes-juices/400/300',NULL,3,1,0,NULL,'Shakes & Juices - Order Online','Browse and order from Shakes & Juices near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(24,'Pizza','food-pizza',NULL,'food',NULL,'https://picsum.photos/seed/cat-food-pizza/400/300',NULL,7,1,0,NULL,'Pizza - Order Online','Browse and order from Pizza near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(25,'Burgers & Sandwiches','food-burgers-sandwiches',NULL,'food',NULL,'https://picsum.photos/seed/cat-food-burgers-sandwiches/400/300',NULL,8,1,0,NULL,'Burgers & Sandwiches - Order Online','Browse and order from Burgers & Sandwiches near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(26,'South Indian','food-south-indian',NULL,'food',NULL,'https://picsum.photos/seed/cat-food-south-indian/400/300',NULL,9,1,0,NULL,'South Indian - Order Online','Browse and order from South Indian near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(27,'Chinese','food-chinese',NULL,'food',NULL,'https://picsum.photos/seed/cat-food-chinese/400/300',NULL,10,1,0,NULL,'Chinese - Order Online','Browse and order from Chinese near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(28,'Fruits Vegetables','fruits-vegetables',NULL,'grocery',NULL,'https://picsum.photos/seed/cat-fruits-vegetables/400/300',NULL,0,1,1,NULL,'Fruits & Vegetables - Order Online','Browse and order from Fruits & Vegetables near you.','2026-09-18 04:12:14','2026-09-18 04:12:17',NULL),(29,'Fresh Fruits','grocery-fresh-fruits',28,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-fresh-fruits/400/300',NULL,1,1,0,NULL,'Fresh Fruits - Order Online','Browse and order from Fresh Fruits near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(30,'Vegetables','grocery-vegetables',28,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-vegetables/400/300',NULL,2,1,0,NULL,'Vegetables - Order Online','Browse and order from Vegetables near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(31,'Herbs & Greens','grocery-herbs-greens',28,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-herbs-greens/400/300',NULL,3,1,0,NULL,'Herbs & Greens - Order Online','Browse and order from Herbs & Greens near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(32,'Dairy Eggs','dairy-eggs',NULL,'grocery',NULL,'https://picsum.photos/seed/cat-dairy-eggs/400/300',NULL,0,1,1,NULL,'Dairy & Eggs - Order Online','Browse and order from Dairy & Eggs near you.','2026-09-18 04:12:14','2026-09-18 04:12:17',NULL),(33,'Milk','grocery-milk',32,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-milk/400/300',NULL,1,1,0,NULL,'Milk - Order Online','Browse and order from Milk near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(34,'Cheese & Butter','grocery-cheese-butter',32,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-cheese-butter/400/300',NULL,2,1,0,NULL,'Cheese & Butter - Order Online','Browse and order from Cheese & Butter near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(35,'Yogurt & Curd','grocery-yogurt-curd',32,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-yogurt-curd/400/300',NULL,3,1,0,NULL,'Yogurt & Curd - Order Online','Browse and order from Yogurt & Curd near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(36,'Eggs','grocery-eggs',32,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-eggs/400/300',NULL,4,1,0,NULL,'Eggs - Order Online','Browse and order from Eggs near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(37,'Bakery','bakery',NULL,'grocery',NULL,'https://picsum.photos/seed/cat-bakery/400/300',NULL,0,1,0,NULL,'Bakery - Order Online','Browse and order from Bakery near you.','2026-09-18 04:12:14','2026-09-18 04:12:17',NULL),(38,'Breads','grocery-breads',37,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-breads/400/300',NULL,1,1,0,NULL,'Breads - Order Online','Browse and order from Breads near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(39,'Buns & Rolls','grocery-buns-rolls',37,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-buns-rolls/400/300',NULL,2,1,0,NULL,'Buns & Rolls - Order Online','Browse and order from Buns & Rolls near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(40,'Cakes','grocery-cakes',37,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-cakes/400/300',NULL,3,1,0,NULL,'Cakes - Order Online','Browse and order from Cakes near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(41,'Grains Staples','grains-staples',NULL,'grocery',NULL,'https://picsum.photos/seed/cat-grains-staples/400/300',NULL,0,1,0,NULL,'Grains & Staples - Order Online','Browse and order from Grains & Staples near you.','2026-09-18 04:12:14','2026-09-18 04:12:17',NULL),(42,'Rice','grocery-rice',41,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-rice/400/300',NULL,1,1,0,NULL,'Rice - Order Online','Browse and order from Rice near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(43,'Atta & Flours','grocery-atta-flours',41,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-atta-flours/400/300',NULL,2,1,0,NULL,'Atta & Flours - Order Online','Browse and order from Atta & Flours near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(44,'Pulses & Dal','grocery-pulses-dal',41,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-pulses-dal/400/300',NULL,3,1,0,NULL,'Pulses & Dal - Order Online','Browse and order from Pulses & Dal near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(45,'Spices','grocery-spices',41,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-spices/400/300',NULL,4,1,0,NULL,'Spices - Order Online','Browse and order from Spices near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(46,'Oils & Ghee','grocery-oils-ghee',41,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-oils-ghee/400/300',NULL,5,1,0,NULL,'Oils & Ghee - Order Online','Browse and order from Oils & Ghee near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(47,'Snacks','snacks',NULL,'grocery',NULL,'https://picsum.photos/seed/cat-snacks/400/300',NULL,0,1,0,NULL,'Snacks - Order Online','Browse and order from Snacks near you.','2026-09-18 04:12:14','2026-09-18 04:12:17',NULL),(48,'Chips & Namkeen','grocery-chips-namkeen',47,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-chips-namkeen/400/300',NULL,1,1,0,NULL,'Chips & Namkeen - Order Online','Browse and order from Chips & Namkeen near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(49,'Biscuits & Cookies','grocery-biscuits-cookies',47,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-biscuits-cookies/400/300',NULL,2,1,0,NULL,'Biscuits & Cookies - Order Online','Browse and order from Biscuits & Cookies near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(50,'Chocolates','grocery-chocolates',47,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-chocolates/400/300',NULL,3,1,0,NULL,'Chocolates - Order Online','Browse and order from Chocolates near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(51,'Nuts & Dry Fruits','grocery-nuts-dry-fruits',47,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-nuts-dry-fruits/400/300',NULL,4,1,0,NULL,'Nuts & Dry Fruits - Order Online','Browse and order from Nuts & Dry Fruits near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(52,'Grocery Beverages','grocery-beverages',NULL,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-beverages/400/300',NULL,0,1,0,NULL,'Beverages - Order Online','Browse and order from Beverages near you.','2026-09-18 04:12:14','2026-09-18 04:12:17',NULL),(53,'Tea & Coffee','grocery-tea-coffee',52,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-tea-coffee/400/300',NULL,1,1,0,NULL,'Tea & Coffee - Order Online','Browse and order from Tea & Coffee near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(54,'Soft Drinks','grocery-soft-drinks',52,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-soft-drinks/400/300',NULL,2,1,0,NULL,'Soft Drinks - Order Online','Browse and order from Soft Drinks near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(55,'Packaged Water','grocery-packaged-water',52,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-packaged-water/400/300',NULL,3,1,0,NULL,'Packaged Water - Order Online','Browse and order from Packaged Water near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(56,'Home Cleaning','home-cleaning',NULL,'grocery',NULL,'https://picsum.photos/seed/cat-home-cleaning/400/300',NULL,0,1,0,NULL,'Home & Cleaning - Order Online','Browse and order from Home & Cleaning near you.','2026-09-18 04:12:14','2026-09-18 04:12:17',NULL),(57,'Detergents','grocery-detergents',56,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-detergents/400/300',NULL,1,1,0,NULL,'Detergents - Order Online','Browse and order from Detergents near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(58,'Cleaning Supplies','grocery-cleaning-supplies',56,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-cleaning-supplies/400/300',NULL,2,1,0,NULL,'Cleaning Supplies - Order Online','Browse and order from Cleaning Supplies near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(59,'Disposables','grocery-disposables',56,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-disposables/400/300',NULL,3,1,0,NULL,'Disposables - Order Online','Browse and order from Disposables near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(60,'Personal Care','personal-care',NULL,'grocery',NULL,'https://picsum.photos/seed/cat-personal-care/400/300',NULL,0,1,0,NULL,'Personal Care - Order Online','Browse and order from Personal Care near you.','2026-09-18 04:12:14','2026-09-18 04:12:17',NULL),(61,'Bath & Body','grocery-bath-body',60,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-bath-body/400/300',NULL,1,1,0,NULL,'Bath & Body - Order Online','Browse and order from Bath & Body near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(62,'Hair Care','grocery-hair-care',60,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-hair-care/400/300',NULL,2,1,0,NULL,'Hair Care - Order Online','Browse and order from Hair Care near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(63,'Oral Care','grocery-oral-care',60,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-oral-care/400/300',NULL,3,1,0,NULL,'Oral Care - Order Online','Browse and order from Oral Care near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(64,'Skincare','grocery-skincare',60,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-skincare/400/300',NULL,4,1,0,NULL,'Skincare - Order Online','Browse and order from Skincare near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(65,'Frozen Food','grocery-frozen-food',NULL,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-frozen-food/400/300',NULL,9,1,0,NULL,'Frozen Food - Order Online','Browse and order from Frozen Food near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(66,'Ready to Eat','grocery-ready-to-eat',NULL,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-ready-to-eat/400/300',NULL,10,1,0,NULL,'Ready To Eat - Order Online','Browse and order from Ready to Eat near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(67,'Baby Care','grocery-baby-care',NULL,'grocery',NULL,'https://picsum.photos/seed/cat-grocery-baby-care/400/300',NULL,11,1,0,NULL,'Baby Care - Order Online','Browse and order from Baby Care near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(68,'Car','rides-car',NULL,'rides',NULL,'https://picsum.photos/seed/cat-rides-car/400/300',NULL,1,1,0,NULL,'Car - Order Online','Browse and order from Car near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(69,'Bike','rides-bike',NULL,'rides',NULL,'https://picsum.photos/seed/cat-rides-bike/400/300',NULL,2,1,0,NULL,'Bike - Order Online','Browse and order from Bike near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL),(70,'Auto','rides-auto',NULL,'rides',NULL,'https://picsum.photos/seed/cat-rides-auto/400/300',NULL,3,1,0,NULL,'Auto - Order Online','Browse and order from Auto near you.','2026-09-18 04:12:14','2026-09-18 04:12:14',NULL);
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categorizables`
--

DROP TABLE IF EXISTS `categorizables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorizables` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint unsigned NOT NULL,
  `categorizable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categorizable_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cat_categorizable_unique` (`category_id`,`categorizable_type`,`categorizable_id`),
  KEY `categorizables_categorizable_type_categorizable_id_index` (`categorizable_type`,`categorizable_id`),
  KEY `cat_morph_type_index` (`categorizable_type`,`categorizable_id`),
  CONSTRAINT `categorizables_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categorizables`
--

LOCK TABLES `categorizables` WRITE;
/*!40000 ALTER TABLE `categorizables` DISABLE KEYS */;
INSERT INTO `categorizables` VALUES (1,20,'App\\Models\\Restaurant',1,NULL,NULL),(2,9,'App\\Models\\Restaurant',1,NULL,NULL),(3,13,'App\\Models\\Restaurant',1,NULL,NULL),(4,16,'App\\Models\\Restaurant',1,NULL,NULL),(5,5,'App\\Models\\Restaurant',1,NULL,NULL),(6,1,'App\\Models\\Restaurant',1,NULL,NULL),(7,37,'App\\Models\\Store',1,NULL,NULL),(8,32,'App\\Models\\Store',1,NULL,NULL),(9,28,'App\\Models\\Store',1,NULL,NULL),(10,41,'App\\Models\\Store',1,NULL,NULL),(11,52,'App\\Models\\Store',1,NULL,NULL),(12,56,'App\\Models\\Store',1,NULL,NULL),(13,60,'App\\Models\\Store',1,NULL,NULL),(14,47,'App\\Models\\Store',1,NULL,NULL);
/*!40000 ALTER TABLE `categorizables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cities`
--

DROP TABLE IF EXISTS `cities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cities` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `state_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cities_state_id_foreign` (`state_id`),
  CONSTRAINT `cities_state_id_foreign` FOREIGN KEY (`state_id`) REFERENCES `states` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cities`
--

LOCK TABLES `cities` WRITE;
/*!40000 ALTER TABLE `cities` DISABLE KEYS */;
INSERT INTO `cities` VALUES (1,1,'Jaipur',1,'2026-09-18 04:12:14','2026-09-18 04:12:14');
/*!40000 ALTER TABLE `cities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cms_pages`
--

DROP TABLE IF EXISTS `cms_pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cms_pages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'static',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cms_pages_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cms_pages`
--

LOCK TABLES `cms_pages` WRITE;
/*!40000 ALTER TABLE `cms_pages` DISABLE KEYS */;
/*!40000 ALTER TABLE `cms_pages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `commission_rules`
--

DROP TABLE IF EXISTS `commission_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commission_rules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applicable_to` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('percentage','fixed','hybrid') COLLATE utf8mb4_unicode_ci NOT NULL,
  `percentage_rate` decimal(5,2) DEFAULT NULL,
  `fixed_amount` decimal(10,2) DEFAULT NULL,
  `min_amount` decimal(10,2) DEFAULT NULL,
  `max_amount` decimal(10,2) DEFAULT NULL,
  `vendor_id` bigint unsigned DEFAULT NULL,
  `category_id` bigint unsigned DEFAULT NULL,
  `city_id` bigint unsigned DEFAULT NULL,
  `zone_id` bigint unsigned DEFAULT NULL,
  `vehicle_type_id` bigint unsigned DEFAULT NULL,
  `effective_from` date DEFAULT NULL,
  `effective_to` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `priority` int NOT NULL DEFAULT '0',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `commission_rules_service_applicable_to_is_active_index` (`service`,`applicable_to`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `commission_rules`
--

LOCK TABLES `commission_rules` WRITE;
/*!40000 ALTER TABLE `commission_rules` DISABLE KEYS */;
/*!40000 ALTER TABLE `commission_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `commissions`
--

DROP TABLE IF EXISTS `commissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `commission_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `party_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor_id` bigint unsigned DEFAULT NULL,
  `driver_id` bigint unsigned DEFAULT NULL,
  `delivery_partner_id` bigint unsigned DEFAULT NULL,
  `source_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` bigint unsigned NOT NULL,
  `gross_amount` decimal(12,2) NOT NULL,
  `commission_amount` decimal(12,2) NOT NULL,
  `commission_rate` decimal(5,2) NOT NULL,
  `commission_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `net_amount` decimal(12,2) NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'calculated',
  `breakdown` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `commissions_commission_number_unique` (`commission_number`),
  UNIQUE KEY `commissions_source_once_unique` (`party_type`,`source_type`,`source_id`),
  KEY `commissions_vendor_id_foreign` (`vendor_id`),
  KEY `commissions_driver_id_foreign` (`driver_id`),
  KEY `commissions_delivery_partner_id_foreign` (`delivery_partner_id`),
  KEY `commissions_party_type_source_type_source_id_index` (`party_type`,`source_type`,`source_id`),
  CONSTRAINT `commissions_delivery_partner_id_foreign` FOREIGN KEY (`delivery_partner_id`) REFERENCES `delivery_partners` (`id`) ON DELETE SET NULL,
  CONSTRAINT `commissions_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `commissions_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `commissions`
--

LOCK TABLES `commissions` WRITE;
/*!40000 ALTER TABLE `commissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `commissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `countries`
--

DROP TABLE IF EXISTS `countries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `countries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `countries_code_unique` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `countries`
--

LOCK TABLES `countries` WRITE;
/*!40000 ALTER TABLE `countries` DISABLE KEYS */;
INSERT INTO `countries` VALUES (1,'India','IN','+91','INR',1,'2026-09-18 04:12:14','2026-09-18 04:12:14');
/*!40000 ALTER TABLE `countries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coupon_usages`
--

DROP TABLE IF EXISTS `coupon_usages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coupon_usages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `coupon_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `order_id` bigint unsigned DEFAULT NULL,
  `ride_id` bigint unsigned DEFAULT NULL,
  `discount_amount` decimal(10,2) NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'used',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupon_usages_coupon_id_order_id_unique` (`coupon_id`,`order_id`),
  KEY `coupon_usages_user_id_foreign` (`user_id`),
  KEY `coupon_usages_coupon_id_user_id_index` (`coupon_id`,`user_id`),
  CONSTRAINT `coupon_usages_coupon_id_foreign` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `coupon_usages_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coupon_usages`
--

LOCK TABLES `coupon_usages` WRITE;
/*!40000 ALTER TABLE `coupon_usages` DISABLE KEYS */;
/*!40000 ALTER TABLE `coupon_usages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coupons`
--

DROP TABLE IF EXISTS `coupons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coupons` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `type` enum('percentage','fixed','shipping') COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `max_discount` decimal(10,2) DEFAULT NULL,
  `min_order_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `service` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vendor_id` bigint unsigned DEFAULT NULL,
  `category_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zone_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_eligibility` enum('all','new','existing') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `usage_limit` int unsigned DEFAULT NULL,
  `per_user_limit` int unsigned NOT NULL DEFAULT '1',
  `payment_methods` enum('all','wallet','online','cod') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `starts_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `time_start` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `time_end` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `day_of_week` enum('all','0','1','2','3','4','5','6') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `first_order_only` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `total_uses` int NOT NULL DEFAULT '0',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupons_code_unique` (`code`),
  KEY `coupons_service_status_expires_at_index` (`service`,`status`,`expires_at`),
  KEY `coupons_code_index` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coupons`
--

LOCK TABLES `coupons` WRITE;
/*!40000 ALTER TABLE `coupons` DISABLE KEYS */;
/*!40000 ALTER TABLE `coupons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_fee_rules`
--

DROP TABLE IF EXISTS `delivery_fee_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_fee_rules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'food',
  `base_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `per_km` decimal(10,2) NOT NULL DEFAULT '0.00',
  `peak_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `surge_multiplier` decimal(4,2) NOT NULL DEFAULT '1.00',
  `weather_surcharge` decimal(10,2) NOT NULL DEFAULT '0.00',
  `small_order_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `min_order_for_free_delivery` decimal(10,2) DEFAULT NULL,
  `platform_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `zone_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `peak_hour_start` enum('none','0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `peak_hour_end` enum('none','0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `peak_days` enum('all','weekdays','weekends') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_fee_rules`
--

LOCK TABLES `delivery_fee_rules` WRITE;
/*!40000 ALTER TABLE `delivery_fee_rules` DISABLE KEYS */;
INSERT INTO `delivery_fee_rules` VALUES (1,'Default Food Delivery Fee','food',30.00,5.00,10.00,1.00,0.00,0.00,500.00,5.00,NULL,NULL,'none','none','all',1,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(2,'Default Grocery Delivery Fee','grocery',40.00,5.00,10.00,1.00,0.00,10.00,800.00,5.00,NULL,NULL,'none','none','all',1,'2026-09-18 04:12:15','2026-09-18 04:12:15');
/*!40000 ALTER TABLE `delivery_fee_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_partner_earnings`
--

DROP TABLE IF EXISTS `delivery_partner_earnings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_partner_earnings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `delivery_partner_id` bigint unsigned NOT NULL,
  `order_id` bigint unsigned NOT NULL,
  `earning_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'delivery',
  `status` enum('earned','paid','reversed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'earned',
  `payout_id` bigint unsigned DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `idempotency_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dpe_order_partner_unique` (`order_id`,`delivery_partner_id`),
  UNIQUE KEY `delivery_partner_earnings_earning_number_unique` (`earning_number`),
  KEY `delivery_partner_earnings_payout_id_foreign` (`payout_id`),
  KEY `dpe_partner_status_index` (`delivery_partner_id`,`status`),
  CONSTRAINT `delivery_partner_earnings_delivery_partner_id_foreign` FOREIGN KEY (`delivery_partner_id`) REFERENCES `delivery_partners` (`id`) ON DELETE CASCADE,
  CONSTRAINT `delivery_partner_earnings_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `delivery_partner_earnings_payout_id_foreign` FOREIGN KEY (`payout_id`) REFERENCES `payouts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_partner_earnings`
--

LOCK TABLES `delivery_partner_earnings` WRITE;
/*!40000 ALTER TABLE `delivery_partner_earnings` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery_partner_earnings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_partners`
--

DROP TABLE IF EXISTS `delivery_partners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_partners` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `vehicle_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bike',
  `service_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'food',
  `vehicle_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicle_model` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicle_color` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `license_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `license_expiry` date DEFAULT NULL,
  `aadhar_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_ifsc` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `current_zone_id` bigint unsigned DEFAULT NULL,
  `heading` decimal(5,2) DEFAULT NULL,
  `speed` decimal(6,2) DEFAULT NULL,
  `accuracy` decimal(6,2) DEFAULT NULL,
  `last_location_at` timestamp NULL DEFAULT NULL,
  `is_online` tinyint(1) NOT NULL DEFAULT '0',
  `is_busy` tinyint(1) NOT NULL DEFAULT '0',
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `documents` json DEFAULT NULL,
  `kyc_data` json DEFAULT NULL,
  `rating` decimal(3,2) NOT NULL DEFAULT '0.00',
  `rating_count` int unsigned NOT NULL DEFAULT '0',
  `total_deliveries` int unsigned NOT NULL DEFAULT '0',
  `total_earnings` decimal(10,2) NOT NULL DEFAULT '0.00',
  `accepted_orders` int unsigned NOT NULL DEFAULT '0',
  `rejected_orders` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `delivery_partners_user_id_unique` (`user_id`),
  KEY `delivery_partners_status_is_online_index` (`status`,`is_online`),
  KEY `delivery_partners_latitude_longitude_index` (`latitude`,`longitude`),
  KEY `delivery_partners_service_type_status_is_online_index` (`service_type`,`status`,`is_online`),
  KEY `delivery_partners_current_zone_id_foreign` (`current_zone_id`),
  CONSTRAINT `delivery_partners_current_zone_id_foreign` FOREIGN KEY (`current_zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL,
  CONSTRAINT `delivery_partners_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_partners`
--

LOCK TABLES `delivery_partners` WRITE;
/*!40000 ALTER TABLE `delivery_partners` DISABLE KEYS */;
INSERT INTO `delivery_partners` VALUES (3,18,'online','bike','food','DL-02-CD-5678',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,28.6200000,77.2100000,NULL,NULL,NULL,NULL,'2026-09-18 04:12:15',1,0,NULL,NULL,NULL,NULL,4.60,90,0,0.00,0,0,'2026-09-18 04:12:15','2026-09-18 04:12:15',NULL),(4,21,'online','bike','food','RJ-27-AB-1001',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9124000,75.7873000,NULL,NULL,NULL,NULL,'2026-09-18 04:12:16',1,0,NULL,NULL,NULL,NULL,4.70,60,0,0.00,0,0,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(5,22,'online','scooter','food','RJ-27-CD-1002',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9205000,75.7957000,NULL,NULL,NULL,NULL,'2026-09-18 04:12:16',1,0,NULL,NULL,NULL,NULL,4.60,60,0,0.00,0,0,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(6,23,'online','bike','food','RJ-27-EF-1003',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9045000,75.7768000,NULL,NULL,NULL,NULL,'2026-09-18 04:12:17',1,0,NULL,NULL,NULL,NULL,4.50,60,0,0.00,0,0,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(7,24,'online','scooter','food','RJ-27-GH-1004',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9170000,75.7720000,NULL,NULL,NULL,NULL,'2026-09-18 04:12:17',1,0,NULL,NULL,NULL,NULL,4.80,60,0,0.00,0,0,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(8,25,'online','bike','food','RJ-27-IJ-1005',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.8990000,75.8005000,NULL,NULL,NULL,NULL,'2026-09-18 04:12:17',1,0,NULL,NULL,NULL,NULL,4.40,60,0,0.00,0,0,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(9,38,'approved','scooter','food','RJ-27-301-4EDC',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9124000,75.7873000,1,NULL,NULL,NULL,'2026-09-18 04:12:20',1,0,NULL,NULL,NULL,NULL,4.80,243,0,0.00,0,0,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(10,39,'approved','bike','food','RJ-27-302-B8DE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9080000,75.8000000,1,NULL,NULL,NULL,'2026-09-18 04:12:20',1,0,NULL,NULL,NULL,NULL,4.70,155,0,0.00,0,0,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(11,40,'approved','scooter','food','RJ-27-303-348F',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9180000,75.8260000,1,NULL,NULL,NULL,'2026-09-18 04:12:20',1,0,NULL,NULL,NULL,NULL,4.60,211,0,0.00,0,0,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(12,41,'approved','scooter','grocery','RJ-27-301-78E5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9150000,75.7800000,1,NULL,NULL,NULL,'2026-09-18 04:12:21',1,0,NULL,NULL,NULL,NULL,4.20,205,0,0.00,0,0,'2026-09-18 04:12:21','2026-09-18 04:12:21',NULL),(13,42,'approved','bike','grocery','RJ-27-302-C95C',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9124000,75.7873000,1,NULL,NULL,NULL,'2026-09-18 04:12:21',1,0,NULL,NULL,NULL,NULL,4.70,195,0,0.00,0,0,'2026-09-18 04:12:21','2026-09-18 04:12:21',NULL),(14,46,'approved','scooter','food','RJ-27-201-36D2',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9600000,75.7900000,2,NULL,NULL,NULL,'2026-09-18 04:12:22',1,0,NULL,NULL,NULL,NULL,4.50,180,0,0.00,0,0,'2026-09-18 04:12:22','2026-09-18 04:12:22',NULL),(15,47,'approved','bike','food','RJ-27-202-0FAF',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9450000,75.7450000,2,NULL,NULL,NULL,'2026-09-18 04:12:22',1,0,NULL,NULL,NULL,NULL,4.60,142,0,0.00,0,0,'2026-09-18 04:12:22','2026-09-18 04:12:22',NULL),(16,48,'approved','scooter','food','RJ-27-203-40E6',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9550000,75.7700000,2,NULL,NULL,NULL,'2026-09-18 04:12:22',1,0,NULL,NULL,NULL,NULL,4.60,35,0,0.00,0,0,'2026-09-18 04:12:22','2026-09-18 04:12:22',NULL),(17,49,'approved','scooter','grocery','RJ-27-201-686A',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9350000,75.7600000,2,NULL,NULL,NULL,'2026-09-18 04:12:22',1,0,NULL,NULL,NULL,NULL,4.80,95,0,0.00,0,0,'2026-09-18 04:12:22','2026-09-18 04:12:22',NULL),(18,50,'approved','bike','grocery','RJ-27-202-9AB3',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.9600000,75.7900000,2,NULL,NULL,NULL,'2026-09-18 04:12:22',1,0,NULL,NULL,NULL,NULL,4.70,61,0,0.00,0,0,'2026-09-18 04:12:22','2026-09-18 04:12:22',NULL),(19,54,'approved','scooter','food','RJ-27-101-93C7',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.8457000,75.8048000,3,NULL,NULL,NULL,'2026-09-18 04:12:23',1,0,NULL,NULL,NULL,NULL,4.40,34,0,0.00,0,0,'2026-09-18 04:12:23','2026-09-18 04:12:23',NULL),(20,55,'approved','bike','food','RJ-27-102-D919',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.8300000,75.7500000,3,NULL,NULL,NULL,'2026-09-18 04:12:23',1,0,NULL,NULL,NULL,NULL,4.30,144,0,0.00,0,0,'2026-09-18 04:12:23','2026-09-18 04:12:23',NULL),(21,56,'approved','scooter','food','RJ-27-103-7E4B',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.8400000,75.7600000,3,NULL,NULL,NULL,'2026-09-18 04:12:24',1,0,NULL,NULL,NULL,NULL,4.30,171,0,0.00,0,0,'2026-09-18 04:12:24','2026-09-18 04:12:24',NULL),(22,57,'approved','scooter','grocery','RJ-27-101-72DD',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.8550000,75.8100000,3,NULL,NULL,NULL,'2026-09-28 01:00:17',1,0,NULL,NULL,NULL,NULL,4.70,83,0,0.00,0,0,'2026-09-18 04:12:24','2026-09-28 01:00:17',NULL),(23,58,'approved','bike','grocery','RJ-27-102-8205',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.8457000,75.8048000,3,NULL,NULL,NULL,'2026-09-18 04:12:24',1,0,NULL,NULL,NULL,NULL,4.50,82,0,0.00,0,0,'2026-09-18 04:12:24','2026-09-18 04:12:24',NULL),(25,63,'approved','bike','food','RJ-14-AC-7667','Hero Splendor','black','DL-4378636756735','2034-06-13','564573564534','foodpartner1','000054536272','SBIN000746','SBI',26.8458056,75.8046714,3,NULL,NULL,NULL,'2026-09-28 00:45:44',1,0,NULL,'2026-09-18 05:20:11',NULL,NULL,0.00,0,16,991.67,0,0,'2026-09-18 05:20:03','2026-09-28 00:45:44',NULL),(26,65,'approved','bike','food','RJ-14-BA-3467','Hero Splendor','Black','DL-37846783465783','2037-07-16','564734567835','grocerypartner1','000045678934','SBIN000464','SBI',26.8457243,75.8047489,3,NULL,NULL,NULL,'2026-09-28 01:06:25',1,0,NULL,'2026-09-18 06:49:43',NULL,NULL,0.00,0,14,871.36,0,0,'2026-09-18 06:49:18','2026-09-28 01:06:25',NULL);
/*!40000 ALTER TABLE `delivery_partners` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_slots`
--

DROP TABLE IF EXISTS `delivery_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_slots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `store_id` bigint unsigned DEFAULT NULL,
  `vendor_id` bigint unsigned DEFAULT NULL,
  `day_of_week` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `max_orders` int unsigned NOT NULL DEFAULT '10',
  `booked_orders` int unsigned NOT NULL DEFAULT '0',
  `lead_time_min` int NOT NULL DEFAULT '60',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `delivery_slots_store_id_foreign` (`store_id`),
  KEY `delivery_slots_vendor_id_foreign` (`vendor_id`),
  CONSTRAINT `delivery_slots_store_id_foreign` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL,
  CONSTRAINT `delivery_slots_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_slots`
--

LOCK TABLES `delivery_slots` WRITE;
/*!40000 ALTER TABLE `delivery_slots` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery_slots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dispatch_logs`
--

DROP TABLE IF EXISTS `dispatch_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dispatch_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `dispatch_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` bigint unsigned DEFAULT NULL,
  `ride_id` bigint unsigned DEFAULT NULL,
  `candidate_id` bigint unsigned DEFAULT NULL,
  `candidate_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `distance_km` decimal(8,2) DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `dispatch_logs_dispatch_type_status_index` (`dispatch_type`,`status`),
  KEY `dispatch_logs_candidate_status_idx` (`candidate_id`,`status`),
  KEY `dispatch_logs_order_status_idx` (`order_id`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dispatch_logs`
--

LOCK TABLES `dispatch_logs` WRITE;
/*!40000 ALTER TABLE `dispatch_logs` DISABLE KEYS */;
INSERT INTO `dispatch_logs` VALUES (2,'delivery',1,NULL,22,'delivery_partner',1.16,'pending','2026-09-28 01:01:02','{\"drop\": {\"id\": 4, \"city\": \"Jaipur Municipal Corporation\", \"meta\": null, \"type\": \"delivery\", \"label\": \"Home\", \"state\": \"Rajasthan\", \"country\": \"India\", \"user_id\": 64, \"landmark\": null, \"latitude\": \"26.8146217\", \"place_id\": \"nominatim:node:2188691283\", \"longitude\": \"75.7731874\", \"created_at\": \"2026-09-21T10:42:24.000000Z\", \"deleted_at\": null, \"is_default\": false, \"updated_at\": \"2026-09-21T10:42:24.000000Z\", \"postal_code\": \"302029\", \"contact_name\": null, \"contact_phone\": null, \"address_line_1\": \"Sanganer\", \"address_line_2\": \"near sanganer thana\", \"formatted_address\": \"Sanganer, Society Walking Path, Jaipur Municipal Corporation, Sanganer Tehsil, Jaipur, Rajasthan, 302029, India\"}, \"pickup\": {\"name\": \"FreshMart Supermarket\", \"address\": \"Janpath, New Delhi\", \"latitude\": 26.8456891, \"longitude\": 75.8048003}, \"offered_at\": \"2026-09-28T06:30:17.968555Z\", \"service_type\": \"grocery\", \"service_label\": \"Grocery delivery\", \"partner_latitude\": 26.855, \"earning_breakdown\": {\"basis\": \"customer_delivery_fee_plus_admin_per_km\", \"per_km\": 11, \"service\": \"grocery\", \"per_km_key\": \"grocery_delivery_fee_paid_by_admin_per_km\", \"distance_km\": 4.67, \"platform_funded\": 51.37, \"distance_earning\": 51.37, \"customer_delivery_fee\": 13.35}, \"estimated_earning\": 64.72, \"partner_longitude\": 75.81, \"delivery_distance_km\": 4.67, \"customer_delivery_fee\": 13.35, \"estimated_pickup_eta_min\": 5, \"estimated_partner_earning\": 64.72}','2026-09-28 06:30:17'),(3,'delivery',2,NULL,22,'delivery_partner',1.16,'pending','2026-09-28 01:02:46','{\"drop\": {\"id\": 4, \"city\": \"Jaipur Municipal Corporation\", \"meta\": null, \"type\": \"delivery\", \"label\": \"Home\", \"state\": \"Rajasthan\", \"country\": \"India\", \"user_id\": 64, \"landmark\": null, \"latitude\": \"26.8146217\", \"place_id\": \"nominatim:node:2188691283\", \"longitude\": \"75.7731874\", \"created_at\": \"2026-09-21T10:42:24.000000Z\", \"deleted_at\": null, \"is_default\": false, \"updated_at\": \"2026-09-21T10:42:24.000000Z\", \"postal_code\": \"302029\", \"contact_name\": null, \"contact_phone\": null, \"address_line_1\": \"Sanganer\", \"address_line_2\": \"near sanganer thana\", \"formatted_address\": \"Sanganer, Society Walking Path, Jaipur Municipal Corporation, Sanganer Tehsil, Jaipur, Rajasthan, 302029, India\"}, \"pickup\": {\"name\": \"FreshMart Supermarket\", \"address\": \"Janpath, New Delhi\", \"latitude\": 26.8456891, \"longitude\": 75.8048003}, \"offered_at\": \"2026-09-28T06:32:01.262030Z\", \"service_type\": \"grocery\", \"service_label\": \"Grocery delivery\", \"partner_latitude\": 26.855, \"earning_breakdown\": {\"basis\": \"customer_delivery_fee_plus_admin_per_km\", \"per_km\": 11, \"service\": \"grocery\", \"per_km_key\": \"grocery_delivery_fee_paid_by_admin_per_km\", \"distance_km\": 4.67, \"platform_funded\": 51.37, \"distance_earning\": 51.37, \"customer_delivery_fee\": 13.35}, \"estimated_earning\": 64.72, \"partner_longitude\": 75.81, \"delivery_distance_km\": 4.67, \"customer_delivery_fee\": 13.35, \"estimated_pickup_eta_min\": 5, \"estimated_partner_earning\": 64.72}','2026-09-28 06:32:01');
/*!40000 ALTER TABLE `dispatch_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `driver_earnings`
--

DROP TABLE IF EXISTS `driver_earnings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `driver_earnings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `driver_id` bigint unsigned NOT NULL,
  `ride_id` bigint unsigned NOT NULL,
  `trip_fare` decimal(10,2) NOT NULL,
  `driver_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `commission_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `commission_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `earning_amount` decimal(10,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `driver_earnings_ride_id_unique` (`ride_id`),
  KEY `driver_earnings_driver_id_created_at_index` (`driver_id`,`created_at`),
  CONSTRAINT `driver_earnings_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `driver_earnings_ride_id_foreign` FOREIGN KEY (`ride_id`) REFERENCES `rides` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `driver_earnings`
--

LOCK TABLES `driver_earnings` WRITE;
/*!40000 ALTER TABLE `driver_earnings` DISABLE KEYS */;
/*!40000 ALTER TABLE `driver_earnings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `drivers`
--

DROP TABLE IF EXISTS `drivers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `drivers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `vehicle_type_id` bigint unsigned DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `vehicle_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicle_model` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicle_color` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `license_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `license_expiry` date DEFAULT NULL,
  `aadhar_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pan_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_ifsc` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `heading` decimal(5,2) DEFAULT NULL,
  `speed` decimal(6,2) DEFAULT NULL,
  `accuracy` decimal(6,2) DEFAULT NULL,
  `current_zone_id` bigint unsigned DEFAULT NULL,
  `last_location_at` timestamp NULL DEFAULT NULL,
  `is_online` tinyint(1) NOT NULL DEFAULT '0',
  `is_busy` tinyint(1) NOT NULL DEFAULT '0',
  `is_verified` tinyint(1) NOT NULL DEFAULT '0',
  `verified_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `documents` json DEFAULT NULL,
  `kyc_data` json DEFAULT NULL,
  `biometric_data` json DEFAULT NULL,
  `rating` decimal(3,2) NOT NULL DEFAULT '0.00',
  `rating_count` int unsigned NOT NULL DEFAULT '0',
  `total_trips` int unsigned NOT NULL DEFAULT '0',
  `accepted_rides` int unsigned NOT NULL DEFAULT '0',
  `rejected_rides` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `drivers_user_id_unique` (`user_id`),
  KEY `drivers_vehicle_type_id_foreign` (`vehicle_type_id`),
  KEY `drivers_status_is_online_index` (`status`,`is_online`),
  KEY `drivers_latitude_longitude_index` (`latitude`,`longitude`),
  KEY `drivers_current_zone_id_foreign` (`current_zone_id`),
  CONSTRAINT `drivers_current_zone_id_foreign` FOREIGN KEY (`current_zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL,
  CONSTRAINT `drivers_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `drivers_vehicle_type_id_foreign` FOREIGN KEY (`vehicle_type_id`) REFERENCES `vehicle_types` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drivers`
--

LOCK TABLES `drivers` WRITE;
/*!40000 ALTER TABLE `drivers` DISABLE KEYS */;
INSERT INTO `drivers` VALUES (1,17,1,'online','DL-01-AB-1234','Maruti Swift','White','DL-1234567890',NULL,NULL,NULL,NULL,NULL,NULL,NULL,26.8457429,75.8047242,NULL,NULL,NULL,3,'2026-09-18 06:59:50',1,0,0,NULL,NULL,NULL,NULL,NULL,NULL,4.80,120,0,0,0,'2026-09-18 04:12:15','2026-09-18 06:59:50',NULL),(2,43,2,'approved','RJ-27-301-3B50','Bajaj RE','White','RJ-3B50DEA275','2029-09-18',NULL,NULL,NULL,NULL,NULL,NULL,26.9080000,75.8000000,NULL,NULL,NULL,1,'2026-09-18 04:12:21',1,0,1,'2026-09-18 04:12:21',NULL,NULL,NULL,NULL,NULL,4.40,181,0,0,0,'2026-09-18 04:12:21','2026-09-18 04:12:21',NULL),(3,44,3,'approved','RJ-27-302-87F9','Maruti Alto','White','RJ-87F901E8B9','2029-09-18',NULL,NULL,NULL,NULL,NULL,NULL,26.9180000,75.8260000,NULL,NULL,NULL,1,'2026-09-18 04:12:21',1,0,1,'2026-09-18 04:12:21',NULL,NULL,NULL,NULL,NULL,4.30,97,0,0,0,'2026-09-18 04:12:21','2026-09-18 04:12:21',NULL),(4,45,1,'approved','RJ-27-303-C95A','Maruti Alto','White','RJ-C95A2BD0CB','2029-09-18',NULL,NULL,NULL,NULL,NULL,NULL,26.9150000,75.7800000,NULL,NULL,NULL,1,'2026-09-18 04:12:21',1,0,1,'2026-09-18 04:12:21',NULL,NULL,NULL,NULL,NULL,4.60,33,0,0,0,'2026-09-18 04:12:21','2026-09-18 04:12:21',NULL),(5,51,2,'approved','RJ-27-201-8D8B','Bajaj RE','White','RJ-8D8B101DCF','2029-09-18',NULL,NULL,NULL,NULL,NULL,NULL,26.9450000,75.7450000,NULL,NULL,NULL,2,'2026-09-18 04:12:23',1,0,1,'2026-09-18 04:12:23',NULL,NULL,NULL,NULL,NULL,4.60,100,0,0,0,'2026-09-18 04:12:23','2026-09-18 04:12:23',NULL),(6,52,3,'approved','RJ-27-202-9957','Maruti Alto','White','RJ-9957A48184','2029-09-18',NULL,NULL,NULL,NULL,NULL,NULL,26.9550000,75.7700000,NULL,NULL,NULL,2,'2026-09-18 04:12:23',1,0,1,'2026-09-18 04:12:23',NULL,NULL,NULL,NULL,NULL,4.30,142,0,0,0,'2026-09-18 04:12:23','2026-09-18 04:12:23',NULL),(7,53,1,'approved','RJ-27-203-E9C7','Maruti Alto','White','RJ-E9C7208010','2029-09-18',NULL,NULL,NULL,NULL,NULL,NULL,26.9350000,75.7600000,NULL,NULL,NULL,2,'2026-09-18 04:12:23',1,0,1,'2026-09-18 04:12:23',NULL,NULL,NULL,NULL,NULL,4.60,76,0,0,0,'2026-09-18 04:12:23','2026-09-18 04:12:23',NULL),(8,59,2,'approved','RJ-27-101-502F','Bajaj RE','White','RJ-502F4C0D4C','2029-09-18',NULL,NULL,NULL,NULL,NULL,NULL,26.8300000,75.7500000,NULL,NULL,NULL,3,'2026-09-18 04:12:24',1,0,1,'2026-09-18 04:12:24',NULL,NULL,NULL,NULL,NULL,4.50,54,0,0,0,'2026-09-18 04:12:24','2026-09-18 04:12:24',NULL),(9,60,3,'approved','RJ-27-102-8B71','Maruti Alto','White','RJ-8B714156C1','2029-09-18',NULL,NULL,NULL,NULL,NULL,NULL,26.8400000,75.7600000,NULL,NULL,NULL,3,'2026-09-18 04:12:24',1,0,1,'2026-09-18 04:12:24',NULL,NULL,NULL,NULL,NULL,4.70,196,0,0,0,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(10,61,1,'approved','RJ-27-103-EB6B','Maruti Alto','White','RJ-EB6BEFC2CA','2029-09-18',NULL,NULL,NULL,NULL,NULL,NULL,26.8550000,75.8100000,NULL,NULL,NULL,3,'2026-09-18 04:12:25',1,0,1,'2026-09-18 04:12:25',NULL,NULL,NULL,NULL,NULL,4.30,92,0,0,0,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(11,66,1,'approved','RJ-14-AC-3454','Hero Passion','Black','DL-37465734534','2031-06-18','768686746578','GHTYE6735T','driver1','000065768695','SBIN0007576','SBI',26.8457540,75.8046931,NULL,NULL,NULL,3,'2026-09-27 22:25:32',1,0,1,'2026-09-18 07:01:53',NULL,'2026-09-18 07:01:55',NULL,NULL,NULL,0.00,0,7,7,0,'2026-09-18 07:01:39','2026-09-27 22:25:32',NULL),(12,67,1,'approved','RJ-14-CA-7575','Hero splendor','black','DL-4857486546','2038-11-17','667684858596','BFTRE6574T','Driver2','0000768687967574','SBIN0007675','SBI',26.8457161,75.8047826,NULL,NULL,NULL,3,'2026-09-26 01:23:46',1,0,1,'2026-09-21 00:59:06',NULL,'2026-09-21 00:59:06',NULL,NULL,NULL,0.00,0,1,1,0,'2026-09-21 00:58:38','2026-09-26 01:23:46',NULL);
/*!40000 ALTER TABLE `drivers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fare_rules`
--

DROP TABLE IF EXISTS `fare_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fare_rules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vehicle_type_id` bigint unsigned NOT NULL,
  `zone_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `base_fare` decimal(10,2) NOT NULL,
  `per_km` decimal(10,2) NOT NULL,
  `per_minute` decimal(10,2) NOT NULL,
  `minimum_fare` decimal(10,2) NOT NULL,
  `booking_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `platform_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tax_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `surge_multiplier_max` decimal(4,2) NOT NULL DEFAULT '2.00',
  `waiting_charge_per_min` decimal(10,2) NOT NULL DEFAULT '1.00',
  `cancellation_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `driver_earn_percentage` decimal(5,2) NOT NULL DEFAULT '80.00',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fare_rules_vehicle_type_id_foreign` (`vehicle_type_id`),
  CONSTRAINT `fare_rules_vehicle_type_id_foreign` FOREIGN KEY (`vehicle_type_id`) REFERENCES `vehicle_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fare_rules`
--

LOCK TABLES `fare_rules` WRITE;
/*!40000 ALTER TABLE `fare_rules` DISABLE KEYS */;
INSERT INTO `fare_rules` VALUES (1,1,NULL,NULL,30.00,6.00,1.00,30.00,10.00,5.00,5.00,2.00,1.00,40.00,75.00,1,NULL,'2026-09-18 04:12:14','2026-09-26 01:59:23'),(2,2,NULL,NULL,40.00,10.00,1.50,40.00,10.00,5.00,5.00,2.00,1.00,50.00,70.00,1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(3,3,NULL,NULL,80.00,15.00,2.00,80.00,15.00,10.00,5.00,2.00,1.00,60.00,70.00,1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(4,4,NULL,NULL,100.00,18.00,2.00,100.00,20.00,10.00,5.00,2.00,1.00,75.00,70.00,1,NULL,'2026-09-18 04:12:14','2026-09-26 01:58:23'),(5,5,NULL,NULL,150.00,22.00,2.50,150.00,25.00,15.00,5.00,2.00,1.00,100.00,65.00,1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14');
/*!40000 ALTER TABLE `fare_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feature_flags`
--

DROP TABLE IF EXISTS `feature_flags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feature_flags` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `feature_flags_key_unique` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feature_flags`
--

LOCK TABLES `feature_flags` WRITE;
/*!40000 ALTER TABLE `feature_flags` DISABLE KEYS */;
INSERT INTO `feature_flags` VALUES (1,'food_enabled','Food Delivery','Enable/disable food delivery service',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(2,'grocery_enabled','Grocery Delivery','Enable/disable grocery delivery service',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(3,'rides_enabled','Ride Hailing','Enable/disable ride hailing service',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(4,'wallet_enabled','Wallet','Enable/disable wallet system',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(5,'cash_on_delivery_enabled','Cash on Delivery','Enable/disable COD',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(6,'ai_recommendations_enabled','AI Recommendations','Enable AI-powered recommendations',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(7,'scheduled_delivery_enabled','Scheduled Delivery','Enable scheduled delivery',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(8,'ride_surge_enabled','Ride Surge Pricing','Enable surge pricing for rides',0,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(9,'referrals_enabled','Referrals','Enable referral system',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(10,'loyalty_enabled','Loyalty Program','Enable loyalty points',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(11,'ai_grocery_prediction_enabled','AI Grocery Prediction','Enable grocery replenishment predictions',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14');
/*!40000 ALTER TABLE `feature_flags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feature_usage_logs`
--

DROP TABLE IF EXISTS `feature_usage_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feature_usage_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `feature` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `feature_usage_logs_user_id_feature_created_at_index` (`user_id`,`feature`,`created_at`),
  KEY `feature_usage_logs_feature_created_at_index` (`feature`,`created_at`),
  CONSTRAINT `feature_usage_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feature_usage_logs`
--

LOCK TABLES `feature_usage_logs` WRITE;
/*!40000 ALTER TABLE `feature_usage_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `feature_usage_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `financial_adjustments`
--

DROP TABLE IF EXISTS `financial_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `financial_adjustments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `adjustment_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `wallet_id` bigint unsigned DEFAULT NULL,
  `wallet_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `direction` enum('credit','debit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `adjusted_by` bigint unsigned DEFAULT NULL,
  `reference_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` bigint unsigned DEFAULT NULL,
  `idempotency_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `financial_adjustments_adjustment_number_unique` (`adjustment_number`),
  KEY `financial_adjustments_wallet_id_foreign` (`wallet_id`),
  KEY `financial_adjustments_adjusted_by_foreign` (`adjusted_by`),
  KEY `financial_adjustments_user_id_created_at_index` (`user_id`,`created_at`),
  CONSTRAINT `financial_adjustments_adjusted_by_foreign` FOREIGN KEY (`adjusted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `financial_adjustments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `financial_adjustments_wallet_id_foreign` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `financial_adjustments`
--

LOCK TABLES `financial_adjustments` WRITE;
/*!40000 ALTER TABLE `financial_adjustments` DISABLE KEYS */;
/*!40000 ALTER TABLE `financial_adjustments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incentives`
--

DROP TABLE IF EXISTS `incentives`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incentives` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apply_to` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `amount_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'fixed',
  `min_trips` int unsigned DEFAULT NULL,
  `min_amount` decimal(10,2) DEFAULT NULL,
  `city_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `starts_at` date DEFAULT NULL,
  `ends_at` date DEFAULT NULL,
  `time_start` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `time_end` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incentives`
--

LOCK TABLES `incentives` WRITE;
/*!40000 ALTER TABLE `incentives` DISABLE KEYS */;
/*!40000 ALTER TABLE `incentives` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `integration_settings`
--

DROP TABLE IF EXISTS `integration_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `integration_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `service` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mock',
  `environment` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'test',
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `credentials` text COLLATE utf8mb4_unicode_ci,
  `settings` json DEFAULT NULL,
  `last_tested_at` timestamp NULL DEFAULT NULL,
  `last_test_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_test_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_settings_service_unique` (`service`),
  KEY `integration_settings_is_enabled_index` (`is_enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `integration_settings`
--

LOCK TABLES `integration_settings` WRITE;
/*!40000 ALTER TABLE `integration_settings` DISABLE KEYS */;
INSERT INTO `integration_settings` VALUES (1,'maps','google','live',1,'eyJpdiI6IjFIeWtzK05FUnR4OGFMQW5qSVVWZEE9PSIsInZhbHVlIjoib2FCY2xhUi8xSzRxWS91ZGNQVnJ1L0p2eEZpU2ZhZFp4RjhYNmcwSEt1ZGtxdlN3SEMxcllNdGJzSm9PQlFGTG5DWmJ5WlJXYm9PUTUwS2JzVUVySHBKalZyYXFwM3dtWUwwNElpU0Q2ZkE2WHRPTC9HUWNlRzJkaXl4Z2lBdEllOFpmRm04N3puSUVuSjZLS0NnNXU3Y0ZsVHRvNjZKS0hCaVF1SENmMGtFPSIsIm1hYyI6IjEyYzcxNDA5Njk5MDQ0MjhmMDUxZmM1MzJmZjcwNjE0ZmYwZTBmMGQ0NjA0NjE4MmFiZjNkY2EzZWZhOWFlODkiLCJ0YWciOiIifQ==',NULL,'2026-09-25 01:56:41','error','Geocoding: OK  Routes: OK  Places Search: REQUEST_DENIED (Billing/Places API (New) likely disabled (HTTP 403))  Place Details: REQUEST_DENIED (Billing/Places API (New) likely disabled (HTTP 403))  Enable Billing and the Geocoding + Places APIs on the Google Cloud project for this key.','2026-09-18 05:24:43','2026-09-25 01:57:38'),(2,'payments','razorpay','test',1,'eyJpdiI6Im1wamI4d1ZEa0tlRVJxNEhYSWlkY0E9PSIsInZhbHVlIjoiSFpHSmI1cGJLM0lIb3U0SDhUbGYwMjBxZUYySVFpaU5PVE9BRmNLZGEycXpheFdFbHh0MG1rM3ZCVjZCMHFGTTA2TUI5NFAzdVZVZng1VzJmTWU3VVMvWncwKzlSNTlnS2hTVDl4SXZWOTg9IiwibWFjIjoiNGE4MWNkMzlmZDk3YmUxYzM2NmYyMTVmMGEwZjkyM2YzYzcxZTk3N2ZjYzEyZTg1N2I3NjkyNDQxZTUyZjJiMSIsInRhZyI6IiJ9',NULL,'2026-09-25 01:57:58','ok','Razorpay connection working.','2026-09-22 06:01:29','2026-09-25 01:57:58'),(4,'google_oauth','google','live',1,'eyJpdiI6ImRSby9rbStWakRwZVRSRkU5VEFtQXc9PSIsInZhbHVlIjoiT045cmM1YmFFVmlrUmc0VGZrV3ptTk5YcVhNQlV2dGNtN3o4eElXSjJYbkVyZnRMSThoM1dWLzZvWTVZbS9laXJTckRLTHRhaUpNNXlwTHB0NjBSeUE5aUtNZjRSUm15Qnlsai91SkJnN2VvR2pPQ2szenRkZEI3Y05zc3dIc01EemIyY2JHMTEzaEI0bWRhQmw0UzkvR2c5MXV4RFoya0xWdFlYRFZzV1Z3TFpYZWZ4U09ZT1IvLzN2RTFjV0wzIiwibWFjIjoiZjIxMDcxNmUwMzI0NTAxYzUzOGI0MGQyOTlhNjIyYzk3ZmI2ODZiNjAyNzI0NmZkODk4NDY4OTczYWJmZjMzYiIsInRhZyI6IiJ9',NULL,'2026-09-25 23:39:46','ok','Configuration saved: Client ID looks valid and the Google signing keys are reachable (2 published keys). This does not verify a real sign-in — confirm end-to-end with \"Continue with Google\" on the customer login page.','2026-09-25 07:17:45','2026-09-25 23:39:46'),(5,'smtp','smtp','live',1,'eyJpdiI6InVRM3ZNME50RnFxZWt1c09oNWRFb1E9PSIsInZhbHVlIjoiamJnQXRZUEVWL20zZHRyMGMxa09nbHVxSG1DVHg5d1VncHVuMENQZS9PSnIzbjdRWnBMaGprbEx5MkR0Nys4NXhLbGR1L2VxV1RmOFRHb2dYbS9Jd0JRVENQK1NDc29iUmlrU0xzS05JSEtKZ1BoZTdRVVlBMnZIV0xuQjlYbm10YlBHTzgwV01FS3MyMlhyRlJmZzhWYlJjTXFzMGdqSko0OVBoMzFpVFhKT3QwU1NYUFRGVjVxVnpOd01rNis3ZzE0NFpTNDFzcXVLc0ZnTkhuRURlSVI4aGpMVFFQM0QzK1dPajhTdW10UT0iLCJtYWMiOiI2ZDFlMTIwMDNjMmNhMzgxYTllZDJjZTkwMDI3ZjRjY2Q3ZWM0MzhjZjUxOGRlZjM3Mjk1YjI3YzMyZDE4NTAxIiwidGFnIjoiIn0=',NULL,'2026-09-25 23:21:48','ok','Test email delivered.','2026-09-25 23:05:01','2026-09-25 23:21:48');
/*!40000 ALTER TABLE `integration_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventories`
--

DROP TABLE IF EXISTS `inventories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `product_variant_id` bigint unsigned DEFAULT NULL,
  `quantity` int unsigned NOT NULL DEFAULT '0',
  `reserved_quantity` int unsigned NOT NULL DEFAULT '0',
  `low_stock_threshold` int unsigned NOT NULL DEFAULT '10',
  `track_inventory` tinyint(1) NOT NULL DEFAULT '1',
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventories_product_id_product_variant_id_unique` (`product_id`,`product_variant_id`),
  KEY `inventories_vendor_id_foreign` (`vendor_id`),
  KEY `inventories_product_variant_id_foreign` (`product_variant_id`),
  CONSTRAINT `inventories_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventories_product_variant_id_foreign` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventories_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventories`
--

LOCK TABLES `inventories` WRITE;
/*!40000 ALTER TABLE `inventories` DISABLE KEYS */;
INSERT INTO `inventories` VALUES (4,7,16,NULL,3,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-21 00:55:43'),(5,7,17,NULL,5,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(6,7,18,NULL,30,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(7,7,19,NULL,2,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-21 00:55:43'),(8,7,20,NULL,5,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(9,7,21,NULL,5,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(10,7,22,NULL,5,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(11,7,23,NULL,5,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(12,7,24,NULL,17,5,20,1,NULL,'2026-09-18 04:12:15','2026-09-28 01:01:51'),(13,7,25,NULL,25,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(14,7,26,NULL,4,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-24 01:03:22'),(15,7,27,NULL,5,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(16,7,28,NULL,5,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(17,7,29,NULL,5,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(18,7,30,NULL,5,0,20,1,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(19,11,55,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(20,11,56,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(21,11,57,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(22,11,58,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(23,11,59,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(24,11,60,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(25,11,61,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(26,11,62,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(27,12,63,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(28,12,64,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(29,12,65,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(30,12,66,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(31,12,67,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(32,12,68,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(33,12,69,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(34,12,70,NULL,60,0,10,1,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(35,15,83,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(36,15,84,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(37,15,85,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(38,15,86,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(39,15,87,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(40,15,88,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(41,15,89,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(42,15,90,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(43,16,91,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(44,16,92,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(45,16,93,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(46,16,94,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(47,16,95,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(48,16,96,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(49,16,97,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(50,16,98,NULL,60,0,10,1,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(51,19,111,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(52,19,112,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(53,19,113,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(54,19,114,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(55,19,115,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(56,19,116,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(57,19,117,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(58,19,118,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(59,20,119,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(60,20,120,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(61,20,121,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(62,20,122,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(63,20,123,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(64,20,124,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(65,20,125,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(66,20,126,NULL,60,0,10,1,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20');
/*!40000 ALTER TABLE `inventories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_reservations`
--

DROP TABLE IF EXISTS `inventory_reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_reservations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `order_item_id` bigint unsigned DEFAULT NULL,
  `inventory_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `quantity` int unsigned NOT NULL,
  `state` enum('reserved','sold','released') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reserved',
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_reservations_order_inventory_unique` (`order_id`,`inventory_id`),
  KEY `inventory_reservations_order_item_id_foreign` (`order_item_id`),
  KEY `inventory_reservations_product_id_foreign` (`product_id`),
  KEY `inv_reservations_inventory_state_index` (`inventory_id`,`state`),
  CONSTRAINT `inventory_reservations_inventory_id_foreign` FOREIGN KEY (`inventory_id`) REFERENCES `inventories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_reservations_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_reservations_order_item_id_foreign` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inventory_reservations_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_reservations`
--

LOCK TABLES `inventory_reservations` WRITE;
/*!40000 ALTER TABLE `inventory_reservations` DISABLE KEYS */;
INSERT INTO `inventory_reservations` VALUES (1,1,1,12,24,1,'reserved','Reserved for order #ORD_20260928_2H4D0IFY',NULL,'2026-09-28 00:53:34','2026-09-28 00:53:34'),(2,2,2,12,24,1,'reserved','Reserved for order #ORD_20260928_HCTUIG9P',NULL,'2026-09-28 01:01:51','2026-09-28 01:01:51');
/*!40000 ALTER TABLE `inventory_reservations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_transactions`
--

DROP TABLE IF EXISTS `inventory_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `inventory_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `type` enum('purchase','sale','adjustment','return','damage','expiry','reservation','release') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_change` int NOT NULL,
  `quantity_after` int unsigned NOT NULL,
  `reference_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` bigint unsigned DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `inventory_transactions_inventory_id_foreign` (`inventory_id`),
  KEY `inventory_transactions_product_id_foreign` (`product_id`),
  KEY `inventory_transactions_created_by_foreign` (`created_by`),
  KEY `inventory_transactions_reference_type_reference_id_index` (`reference_type`,`reference_id`),
  CONSTRAINT `inventory_transactions_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inventory_transactions_inventory_id_foreign` FOREIGN KEY (`inventory_id`) REFERENCES `inventories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_transactions_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transactions`
--

LOCK TABLES `inventory_transactions` WRITE;
/*!40000 ALTER TABLE `inventory_transactions` DISABLE KEYS */;
INSERT INTO `inventory_transactions` VALUES (1,12,24,'reservation',1,4,'App\\Models\\Order',1,'Reserved for order #ORD_20260928_2H4D0IFY',64,'2026-09-28 00:53:34','2026-09-28 00:53:34'),(2,12,24,'reservation',1,5,'App\\Models\\Order',2,'Reserved for order #ORD_20260928_HCTUIG9P',64,'2026-09-28 01:01:51','2026-09-28 01:01:51');
/*!40000 ALTER TABLE `inventory_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext COLLATE utf8mb4_unicode_ci,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` smallint unsigned NOT NULL,
  `reserved_at` int unsigned DEFAULT NULL,
  `available_at` int unsigned NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ledger_entries`
--

DROP TABLE IF EXISTS `ledger_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ledger_entries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `entry_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `transaction_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wallet_id` bigint unsigned DEFAULT NULL,
  `reference_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` bigint unsigned DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ledger_entries_entry_id_unique` (`entry_id`),
  KEY `ledger_entries_wallet_id_foreign` (`wallet_id`),
  KEY `ledger_entries_account_name_created_at_index` (`account_name`,`created_at`),
  KEY `ledger_entries_reference_type_reference_id_index` (`reference_type`,`reference_id`),
  KEY `ledger_entries_transaction_id_index` (`transaction_id`),
  CONSTRAINT `ledger_entries_wallet_id_foreign` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ledger_entries`
--

LOCK TABLES `ledger_entries` WRITE;
/*!40000 ALTER TABLE `ledger_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `ledger_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `loyalty_accounts`
--

DROP TABLE IF EXISTS `loyalty_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loyalty_accounts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `points_balance` int NOT NULL DEFAULT '0',
  `lifetime_points` int NOT NULL DEFAULT '0',
  `tier` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bronze',
  `tier_multiplier` decimal(4,2) NOT NULL DEFAULT '1.00',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `loyalty_accounts_user_id_unique` (`user_id`),
  CONSTRAINT `loyalty_accounts_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loyalty_accounts`
--

LOCK TABLES `loyalty_accounts` WRITE;
/*!40000 ALTER TABLE `loyalty_accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `loyalty_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `loyalty_rules`
--

DROP TABLE IF EXISTS `loyalty_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loyalty_rules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `service` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rule_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `points_per_currency` decimal(8,2) NOT NULL DEFAULT '0.00',
  `points_per_order` int unsigned NOT NULL DEFAULT '0',
  `tier_upgrade_threshold` int unsigned DEFAULT NULL,
  `tier` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tier_multiplier` decimal(4,2) NOT NULL DEFAULT '1.00',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loyalty_rules`
--

LOCK TABLES `loyalty_rules` WRITE;
/*!40000 ALTER TABLE `loyalty_rules` DISABLE KEYS */;
INSERT INTO `loyalty_rules` VALUES (1,'food','points_per_amount',1.00,10,NULL,NULL,1.00,1,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(2,'grocery','points_per_amount',1.00,10,NULL,NULL,1.00,1,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(3,'ride','points_per_amount',1.00,5,NULL,NULL,1.00,1,'2026-09-18 04:12:14','2026-09-18 04:12:14');
/*!40000 ALTER TABLE `loyalty_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `loyalty_transactions`
--

DROP TABLE IF EXISTS `loyalty_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loyalty_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `loyalty_account_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `type` enum('EARN','REDEEM','EXPIRE','REVERSE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `points` int NOT NULL,
  `balance_before` int NOT NULL,
  `balance_after` int NOT NULL,
  `source_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` bigint unsigned DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `loyalty_transactions_loyalty_account_id_foreign` (`loyalty_account_id`),
  KEY `loyalty_transactions_user_id_type_index` (`user_id`,`type`),
  KEY `loyalty_transactions_source_type_source_id_index` (`source_type`,`source_id`),
  CONSTRAINT `loyalty_transactions_loyalty_account_id_foreign` FOREIGN KEY (`loyalty_account_id`) REFERENCES `loyalty_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `loyalty_transactions_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loyalty_transactions`
--

LOCK TABLES `loyalty_transactions` WRITE;
/*!40000 ALTER TABLE `loyalty_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `loyalty_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_08_20_000001_create_webhook_tables',1),(5,'2026_09_03_072759_create_personal_access_tokens_table',1),(6,'2026_09_03_100000_create_geo_tables',1),(7,'2026_09_03_100001_create_vendor_tables',1),(8,'2026_09_03_100002_create_catalog_tables',1),(9,'2026_09_03_100003_create_order_tables',1),(10,'2026_09_03_100004_create_ride_tables',1),(11,'2026_09_03_100005_create_financial_tables',1),(12,'2026_09_03_100006_create_financial_engine_tables',1),(13,'2026_09_03_100007_create_system_tables',1),(14,'2026_09_03_100008_create_operations_tables',1),(15,'2026_09_03_101000_make_ledger_reference_nullable',1),(16,'2026_09_07_000000_add_partner_review_fields',1),(17,'2026_09_07_000002_add_service_type_to_delivery_partners',1),(18,'2026_09_07_000003_backfill_vendor_outlets',1),(19,'2026_09_07_000010_add_enterprise_fields_to_categories_table',1),(20,'2026_09_07_000011_create_vendor_categories_table',1),(21,'2026_09_07_000012_create_categorizables_table',1),(22,'2026_09_07_000013_add_vendor_category_id_to_products_table',1),(23,'2026_09_08_000000_create_integration_settings_table',1),(24,'2026_09_08_104745_add_place_fields_to_addresses_table',1),(25,'2026_09_08_175341_add_dispatch_offer_fields_to_dispatch_logs_table',1),(26,'2026_09_10_055154_add_arrived_at_to_orders_table',1),(27,'2026_09_10_120000_create_driver_earnings_table',1),(28,'2026_09_12_070144_add_identity_security_constraints',1),(29,'2026_09_12_082133_harden_coupon_security',1),(30,'2026_09_12_090131_add_order_settlement_and_delivery_fields_to_orders_table',1),(31,'2026_09_12_091416_harden_order_money_and_delivery',1),(32,'2026_09_12_103506_add_partner_location_dynamics_to_delivery_partners_table',1),(33,'2026_09_12_130000_harden_financial_security',1),(34,'2026_09_17_071343_add_service_flags_and_config_to_zones_table',1),(35,'2026_09_17_071344_add_current_zone_id_to_delivery_partners_and_drivers',1),(36,'2026_09_17_071345_add_zone_snapshots_to_orders_and_rides',1),(37,'2026_09_17_071346_add_zone_id_to_vendors_table',1),(38,'2026_09_17_080415_add_driver_location_dynamics_to_drivers_table',1),(39,'2026_09_21_000001_add_address_id_to_carts_table',2),(40,'2026_09_21_101358_add_delivery_gst_to_carts_and_orders_table',3),(41,'2026_09_21_101359_seed_delivery_gst_percent_setting',3),(43,'2026_09_21_112757_service_specific_delivery_settings',4),(44,'2026_09_21_115447_add_grocery_free_delivery_km_setting',5),(45,'2026_09_22_100001_add_food_partner_delivery_settings',6),(46,'2026_09_22_101418_add_service_and_earning_type_to_wallet_transactions',7),(47,'2026_09_22_120000_add_delivery_payment_and_order_otp',8),(48,'2026_09_23_063135_add_delivery_payment_settled_at_to_orders',9),(49,'2026_09_23_113412_add_cash_payment_tracking_to_rides',10),(50,'2026_09_25_043302_add_product_option_support_to_catalog_tables',11),(51,'2026_09_25_124258_add_google_identity_to_users_table',12),(52,'2026_09_28_035233_drop_customer_base_delivery_fee_add_food_free_delivery_km',13),(54,'2026_09_28_043551_add_admin_funded_partner_per_km_delivery_settings',14);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_templates`
--

DROP TABLE IF EXISTS `notification_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_templates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'transactional',
  `channel` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `title_template` text COLLATE utf8mb4_unicode_ci,
  `body_template` text COLLATE utf8mb4_unicode_ci,
  `sms_template` text COLLATE utf8mb4_unicode_ci,
  `email_subject_template` text COLLATE utf8mb4_unicode_ci,
  `email_body_template` longtext COLLATE utf8mb4_unicode_ci,
  `variables` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_templates_key_unique` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_templates`
--

LOCK TABLES `notification_templates` WRITE;
/*!40000 ALTER TABLE `notification_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `channel` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'in_app',
  `reference_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` bigint unsigned DEFAULT NULL,
  `data` json DEFAULT NULL,
  `image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `read_at` timestamp NULL DEFAULT NULL,
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_created_by_foreign` (`created_by`),
  KEY `notifications_user_id_is_read_index` (`user_id`,`is_read`),
  KEY `notifications_reference_type_reference_id_index` (`reference_type`,`reference_id`),
  CONSTRAINT `notifications_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `product_variant_id` bigint unsigned DEFAULT NULL,
  `product_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sku` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `price_snapshot` decimal(10,2) NOT NULL,
  `quantity` int unsigned NOT NULL,
  `line_total` decimal(10,2) NOT NULL,
  `selected_options` json DEFAULT NULL,
  `selected_addons` json DEFAULT NULL,
  `special_instructions` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `order_items_order_id_foreign` (`order_id`),
  KEY `order_items_product_id_foreign` (`product_id`),
  KEY `order_items_product_variant_id_foreign` (`product_variant_id`),
  CONSTRAINT `order_items_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `order_items_product_variant_id_foreign` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` VALUES (1,1,24,NULL,'Aashirvaad Atta','https://picsum.photos/seed/prod-aashirvaad-atta-5kg/600/400',NULL,412.00,412.00,1,412.00,'[{\"price\": 412, \"group_id\": 5, \"option_id\": 13, \"group_name\": \"Kg\", \"option_name\": \"10 Kg\", \"selection_type\": \"SINGLE\"}]',NULL,NULL,'pending',NULL,'2026-09-28 00:53:34','2026-09-28 00:53:34'),(2,2,24,NULL,'Aashirvaad Atta','https://picsum.photos/seed/prod-aashirvaad-atta-5kg/600/400',NULL,412.00,412.00,1,412.00,'[{\"price\": 412, \"group_id\": 5, \"option_id\": 13, \"group_name\": \"Kg\", \"option_name\": \"10 Kg\", \"selection_type\": \"SINGLE\"}]',NULL,NULL,'pending',NULL,'2026-09-28 01:01:51','2026-09-28 01:01:51');
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_ratings`
--

DROP TABLE IF EXISTS `order_ratings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_ratings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `rating` decimal(2,1) NOT NULL DEFAULT '5.0',
  `comment` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_ratings_order_id_user_id_unique` (`order_id`,`user_id`),
  KEY `order_ratings_user_id_foreign` (`user_id`),
  CONSTRAINT `order_ratings_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_ratings_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_ratings`
--

LOCK TABLES `order_ratings` WRITE;
/*!40000 ALTER TABLE `order_ratings` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_ratings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_status_histories`
--

DROP TABLE IF EXISTS `order_status_histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_status_histories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_at` timestamp NULL DEFAULT NULL,
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by` bigint unsigned DEFAULT NULL,
  `changed_by_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `order_status_histories_changed_by_foreign` (`changed_by`),
  KEY `order_status_histories_order_id_status_index` (`order_id`,`status`),
  KEY `osh_order_changed_at_index` (`order_id`,`changed_at`),
  CONSTRAINT `order_status_histories_changed_by_foreign` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `order_status_histories_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_status_histories`
--

LOCK TABLES `order_status_histories` WRITE;
/*!40000 ALTER TABLE `order_status_histories` DISABLE KEYS */;
INSERT INTO `order_status_histories` VALUES (1,1,'PENDING',NULL,NULL,NULL,'Order placed',64,'customer',NULL,'2026-09-28 06:23:34'),(2,1,'ACCEPTED','PENDING','ACCEPTED','2026-09-28 00:54:06',NULL,16,'vendor',NULL,'2026-09-28 06:24:06'),(3,1,'PREPARING','ACCEPTED','PREPARING','2026-09-28 00:54:20',NULL,16,'vendor',NULL,'2026-09-28 06:24:20'),(4,1,'READY','PREPARING','READY','2026-09-28 00:54:49',NULL,16,'vendor',NULL,'2026-09-28 06:24:49'),(5,2,'PENDING',NULL,NULL,NULL,'Order placed',64,'customer',NULL,'2026-09-28 06:31:51'),(6,2,'ACCEPTED','PENDING','ACCEPTED','2026-09-28 01:02:23',NULL,16,'vendor',NULL,'2026-09-28 06:32:23'),(7,2,'PREPARING','ACCEPTED','PREPARING','2026-09-28 01:03:10',NULL,16,'vendor',NULL,'2026-09-28 06:33:10'),(8,2,'READY','PREPARING','READY','2026-09-28 01:03:16',NULL,16,'vendor',NULL,'2026-09-28 06:33:16');
/*!40000 ALTER TABLE `order_status_histories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `idempotency_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idempotency_fingerprint` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` bigint unsigned NOT NULL,
  `vendor_id` bigint unsigned DEFAULT NULL,
  `restaurant_id` bigint unsigned DEFAULT NULL,
  `store_id` bigint unsigned DEFAULT NULL,
  `order_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'food',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLACED',
  `payment_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `payment_method` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_id` bigint unsigned DEFAULT NULL,
  `pickup_zone_id` bigint unsigned DEFAULT NULL,
  `drop_zone_id` bigint unsigned DEFAULT NULL,
  `delivery_address_snapshot` json DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `delivery_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `delivery_gst_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `delivery_gst_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `packaging_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `platform_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `wallet_used` decimal(10,2) NOT NULL DEFAULT '0.00',
  `coupon_discount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `coupon_code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tip_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `round_off` decimal(10,2) NOT NULL DEFAULT '0.00',
  `delivery_partner_id` bigint unsigned DEFAULT NULL,
  `preparation_time_min` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timing_type` enum('instant','scheduled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'instant',
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `preparing_at` timestamp NULL DEFAULT NULL,
  `picking_at` timestamp NULL DEFAULT NULL,
  `packed_at` timestamp NULL DEFAULT NULL,
  `ready_at` timestamp NULL DEFAULT NULL,
  `partner_assigned_at` timestamp NULL DEFAULT NULL,
  `picked_up_at` timestamp NULL DEFAULT NULL,
  `out_for_delivery_at` timestamp NULL DEFAULT NULL,
  `arrived_at` timestamp NULL DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `delivery_payment_collected_at` timestamp NULL DEFAULT NULL,
  `delivery_payment_collected_via` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_payment_settled_at` timestamp NULL DEFAULT NULL,
  `delivery_otp_verified_at` timestamp NULL DEFAULT NULL,
  `delivery_otp_resend_count` int unsigned NOT NULL DEFAULT '0',
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancel_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelled_by_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelled_by` bigint unsigned DEFAULT NULL,
  `customer_note` text COLLATE utf8mb4_unicode_ci,
  `substitution_preference` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'contact',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `original_subtotal` decimal(10,2) DEFAULT NULL,
  `original_delivery_fee` decimal(10,2) DEFAULT NULL,
  `original_total` decimal(10,2) DEFAULT NULL,
  `commission_fee` decimal(10,2) DEFAULT NULL,
  `net_vendor_payout` decimal(10,2) DEFAULT NULL,
  `vendor_payout_status` enum('pending','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vendor_payout_at` timestamp NULL DEFAULT NULL,
  `partner_payout` decimal(10,2) DEFAULT NULL,
  `partner_payout_status` enum('pending','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `partner_payout_at` timestamp NULL DEFAULT NULL,
  `refund_amount` decimal(10,2) DEFAULT NULL,
  `refund_status` enum('pending','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `refunded_at` timestamp NULL DEFAULT NULL,
  `delivered_via` enum('NONE','PENDING','PARTNER_ONLY','PAYMENT_LINK','DELIVERY_FEE_ONLY') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NONE',
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_order_number_unique` (`order_number`),
  UNIQUE KEY `orders_user_id_idempotency_key_unique` (`user_id`,`idempotency_key`),
  KEY `orders_restaurant_id_foreign` (`restaurant_id`),
  KEY `orders_store_id_foreign` (`store_id`),
  KEY `orders_address_id_foreign` (`address_id`),
  KEY `orders_cancelled_by_foreign` (`cancelled_by`),
  KEY `orders_user_id_status_index` (`user_id`,`status`),
  KEY `orders_vendor_id_status_index` (`vendor_id`,`status`),
  KEY `orders_order_type_status_created_at_index` (`order_type`,`status`,`created_at`),
  KEY `orders_order_number_index` (`order_number`),
  KEY `orders_delivery_partner_id_index` (`delivery_partner_id`),
  KEY `orders_scheduled_at_index` (`scheduled_at`),
  KEY `orders_idempotency_fingerprint_index` (`idempotency_fingerprint`),
  KEY `orders_pickup_zone_id_foreign` (`pickup_zone_id`),
  KEY `orders_drop_zone_id_foreign` (`drop_zone_id`),
  CONSTRAINT `orders_address_id_foreign` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_cancelled_by_foreign` FOREIGN KEY (`cancelled_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_delivery_partner_id_foreign` FOREIGN KEY (`delivery_partner_id`) REFERENCES `delivery_partners` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_drop_zone_id_foreign` FOREIGN KEY (`drop_zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_pickup_zone_id_foreign` FOREIGN KEY (`pickup_zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_restaurant_id_foreign` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_store_id_foreign` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `orders_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (1,'ORD_20260928_2H4D0IFY',NULL,NULL,64,7,NULL,1,'grocery','READY','paid','online',4,3,3,'{\"id\": 4, \"city\": \"Jaipur Municipal Corporation\", \"meta\": null, \"type\": \"delivery\", \"label\": \"Home\", \"state\": \"Rajasthan\", \"country\": \"India\", \"user_id\": 64, \"landmark\": null, \"latitude\": \"26.8146217\", \"place_id\": \"nominatim:node:2188691283\", \"longitude\": \"75.7731874\", \"created_at\": \"2026-09-21T10:42:24.000000Z\", \"deleted_at\": null, \"is_default\": false, \"updated_at\": \"2026-09-21T10:42:24.000000Z\", \"postal_code\": \"302029\", \"contact_name\": null, \"contact_phone\": null, \"address_line_1\": \"Sanganer\", \"address_line_2\": \"near sanganer thana\", \"formatted_address\": \"Sanganer, Society Walking Path, Jaipur Municipal Corporation, Sanganer Tehsil, Jaipur, Rajasthan, 302029, India\"}',412.00,0.00,0.00,13.35,18.00,2.40,0.00,0.00,427.75,0.00,0.00,NULL,0.00,0.00,NULL,NULL,'instant',NULL,'2026-09-28 00:54:06','2026-09-28 00:54:20',NULL,NULL,'2026-09-28 00:54:49',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,'contact','{\"dispatch\": {\"status\": \"searching\", \"updated_at\": \"2026-09-28T06:30:18.006981Z\"}}','2026-09-28 00:53:34','2026-09-28 01:00:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'NONE'),(2,'ORD_20260928_HCTUIG9P',NULL,NULL,64,7,NULL,1,'grocery','READY','paid','online',4,3,3,'{\"id\": 4, \"city\": \"Jaipur Municipal Corporation\", \"meta\": null, \"type\": \"delivery\", \"label\": \"Home\", \"state\": \"Rajasthan\", \"country\": \"India\", \"user_id\": 64, \"landmark\": null, \"latitude\": \"26.8146217\", \"place_id\": \"nominatim:node:2188691283\", \"longitude\": \"75.7731874\", \"created_at\": \"2026-09-21T10:42:24.000000Z\", \"deleted_at\": null, \"is_default\": false, \"updated_at\": \"2026-09-21T10:42:24.000000Z\", \"postal_code\": \"302029\", \"contact_name\": null, \"contact_phone\": null, \"address_line_1\": \"Sanganer\", \"address_line_2\": \"near sanganer thana\", \"formatted_address\": \"Sanganer, Society Walking Path, Jaipur Municipal Corporation, Sanganer Tehsil, Jaipur, Rajasthan, 302029, India\"}',412.00,0.00,0.00,13.35,18.00,2.40,0.00,0.00,427.75,0.00,0.00,NULL,0.00,0.00,NULL,NULL,'instant',NULL,'2026-09-28 01:02:23','2026-09-28 01:03:10',NULL,NULL,'2026-09-28 01:03:16',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,'contact','{\"dispatch\": {\"status\": \"searching\", \"updated_at\": \"2026-09-28T06:32:01.289478Z\"}}','2026-09-28 01:01:51','2026-09-28 01:03:16',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'NONE');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `otp_codes`
--

DROP TABLE IF EXISTS `otp_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `otp_codes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purpose` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'login',
  `token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `otp_codes_phone_purpose_index` (`phone`,`purpose`),
  KEY `otp_codes_order_id_purpose_index` (`order_id`,`purpose`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `otp_codes`
--

LOCK TABLES `otp_codes` WRITE;
/*!40000 ALTER TABLE `otp_codes` DISABLE KEYS */;
/*!40000 ALTER TABLE `otp_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_transactions`
--

DROP TABLE IF EXISTS `payment_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payment_id` bigint unsigned NOT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `payment_transactions_payment_id_status_index` (`payment_id`,`status`),
  CONSTRAINT `payment_transactions_payment_id_foreign` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_transactions`
--

LOCK TABLES `payment_transactions` WRITE;
/*!40000 ALTER TABLE `payment_transactions` DISABLE KEYS */;
INSERT INTO `payment_transactions` VALUES (1,1,'INITIATED','payment_initiated','{\"id\": \"order_ThMAgJ90YvgsQ2\", \"notes\": {\"user_id\": 64, \"payable_id\": 1, \"payable_type\": \"App\\\\Models\\\\Order\", \"payment_number\": \"PAY_20260928062334_HWAACR\"}, \"amount\": 42775, \"entity\": \"order\", \"status\": \"created\", \"receipt\": \"PAY_20260928062334_HWAACR\", \"attempts\": 0, \"currency\": \"INR\", \"offer_id\": null, \"amount_due\": 42775, \"created_at\": 1790576616, \"amount_paid\": 0}',NULL,NULL,'2026-09-28 00:53:36','2026-09-28 00:53:36'),(2,1,'SUCCESS','payment_success','{\"raw\": {\"id\": \"pay_ThMAlqdUIRgGTx\", \"fee\": 1010, \"tax\": 154, \"vpa\": null, \"bank\": \"BARB_R\", \"email\": \"gsinghal6011@gmail.com\", \"notes\": {\"user_id\": 64, \"payable_id\": 1, \"payable_type\": \"App\\\\Models\\\\Order\", \"payment_number\": \"PAY_20260928062334_HWAACR\"}, \"amount\": 42775, \"entity\": \"payment\", \"method\": \"netbanking\", \"status\": \"captured\", \"wallet\": null, \"card_id\": null, \"contact\": \"+916377942673\", \"captured\": true, \"currency\": \"INR\", \"order_id\": \"order_ThMAgJ90YvgsQ2\", \"created_at\": 1790576622, \"error_code\": null, \"error_step\": null, \"invoice_id\": null, \"description\": \"Payment PAY_20260928062334_HWAACR\", \"error_reason\": null, \"error_source\": null, \"acquirer_data\": {\"bank_transaction_id\": \"3924364\"}, \"international\": false, \"refund_status\": null, \"amount_refunded\": 0, \"error_description\": null}, \"amount\": 42775, \"method\": \"netbanking\", \"status\": \"captured\", \"currency\": \"INR\", \"order_id\": \"order_ThMAgJ90YvgsQ2\", \"payment_id\": \"pay_ThMAlqdUIRgGTx\"}','127.0.0.1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36','2026-09-28 00:53:59','2026-09-28 00:53:59'),(3,2,'INITIATED','payment_initiated','{\"id\": \"order_ThMJQrju9xEvcS\", \"notes\": {\"user_id\": 64, \"payable_id\": 2, \"payable_type\": \"App\\\\Models\\\\Order\", \"payment_number\": \"PAY_20260928063151_COFD2L\"}, \"amount\": 42775, \"entity\": \"order\", \"status\": \"created\", \"receipt\": \"PAY_20260928063151_COFD2L\", \"attempts\": 0, \"currency\": \"INR\", \"offer_id\": null, \"amount_due\": 42775, \"created_at\": 1790577113, \"amount_paid\": 0}',NULL,NULL,'2026-09-28 01:01:53','2026-09-28 01:01:53'),(4,2,'SUCCESS','payment_success','{\"raw\": {\"id\": \"pay_ThMJX3AELjnKgP\", \"fee\": 1010, \"tax\": 154, \"vpa\": null, \"bank\": \"BARB_R\", \"email\": \"gsinghal6011@gmail.com\", \"notes\": {\"user_id\": 64, \"payable_id\": 2, \"payable_type\": \"App\\\\Models\\\\Order\", \"payment_number\": \"PAY_20260928063151_COFD2L\"}, \"amount\": 42775, \"entity\": \"payment\", \"method\": \"netbanking\", \"status\": \"captured\", \"wallet\": null, \"card_id\": null, \"contact\": \"+916377942673\", \"captured\": true, \"currency\": \"INR\", \"order_id\": \"order_ThMJQrju9xEvcS\", \"created_at\": 1790577120, \"error_code\": null, \"error_step\": null, \"invoice_id\": null, \"description\": \"Payment PAY_20260928063151_COFD2L\", \"error_reason\": null, \"error_source\": null, \"acquirer_data\": {\"bank_transaction_id\": \"1389479\"}, \"international\": false, \"refund_status\": null, \"amount_refunded\": 0, \"error_description\": null}, \"amount\": 42775, \"method\": \"netbanking\", \"status\": \"captured\", \"currency\": \"INR\", \"order_id\": \"order_ThMJQrju9xEvcS\", \"payment_id\": \"pay_ThMJX3AELjnKgP\"}','127.0.0.1','Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36','2026-09-28 01:02:18','2026-09-28 01:02:18');
/*!40000 ALTER TABLE `payment_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_webhook_events`
--

DROP TABLE IF EXISTS `payment_webhook_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_webhook_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `provider` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'received',
  `error` text COLLATE utf8mb4_unicode_ci,
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_webhook_events_provider_event_id_unique` (`provider`,`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_webhook_events`
--

LOCK TABLES `payment_webhook_events` WRITE;
/*!40000 ALTER TABLE `payment_webhook_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_webhook_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payment_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `payable_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payable_id` bigint unsigned DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `amount_paise` bigint unsigned DEFAULT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `method` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gateway` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_reference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_order_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_payment_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_signature` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INITIATED',
  `gateway_response` json DEFAULT NULL,
  `idempotency_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `failed_at` timestamp NULL DEFAULT NULL,
  `failure_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payments_payment_number_unique` (`payment_number`),
  UNIQUE KEY `payments_idempotency_key_unique` (`idempotency_key`),
  UNIQUE KEY `payments_provider_order_id_unique` (`provider_order_id`),
  UNIQUE KEY `payments_provider_payment_id_unique` (`provider_payment_id`),
  KEY `payments_payable_type_payable_id_index` (`payable_type`,`payable_id`),
  KEY `payments_user_id_status_index` (`user_id`,`status`),
  KEY `payments_provider_reference_index` (`provider_reference`),
  CONSTRAINT `payments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,'PAY_20260928062334_HWAACR',64,'App\\Models\\Order',1,427.75,42775,'INR','card','razorpay','pay_ThMAlqdUIRgGTx','order_ThMAgJ90YvgsQ2','pay_ThMAlqdUIRgGTx',NULL,'2026-09-28 00:53:59','SUCCESS','{\"id\": \"pay_ThMAlqdUIRgGTx\", \"fee\": 1010, \"tax\": 154, \"vpa\": null, \"bank\": \"BARB_R\", \"email\": \"gsinghal6011@gmail.com\", \"notes\": {\"user_id\": 64, \"payable_id\": 1, \"payable_type\": \"App\\\\Models\\\\Order\", \"payment_number\": \"PAY_20260928062334_HWAACR\"}, \"amount\": 42775, \"entity\": \"payment\", \"method\": \"netbanking\", \"status\": \"captured\", \"wallet\": null, \"card_id\": null, \"contact\": \"+916377942673\", \"captured\": true, \"currency\": \"INR\", \"order_id\": \"order_ThMAgJ90YvgsQ2\", \"created_at\": 1790576622, \"error_code\": null, \"error_step\": null, \"invoice_id\": null, \"description\": \"Payment PAY_20260928062334_HWAACR\", \"error_reason\": null, \"error_source\": null, \"acquirer_data\": {\"bank_transaction_id\": \"3924364\"}, \"international\": false, \"refund_status\": null, \"amount_refunded\": 0, \"error_description\": null}','checkout:1','2026-09-28 00:53:59',NULL,NULL,'2026-09-28 00:53:34','2026-09-28 00:53:59'),(2,'PAY_20260928063151_COFD2L',64,'App\\Models\\Order',2,427.75,42775,'INR','card','razorpay','pay_ThMJX3AELjnKgP','order_ThMJQrju9xEvcS','pay_ThMJX3AELjnKgP',NULL,'2026-09-28 01:02:18','SUCCESS','{\"id\": \"pay_ThMJX3AELjnKgP\", \"fee\": 1010, \"tax\": 154, \"vpa\": null, \"bank\": \"BARB_R\", \"email\": \"gsinghal6011@gmail.com\", \"notes\": {\"user_id\": 64, \"payable_id\": 2, \"payable_type\": \"App\\\\Models\\\\Order\", \"payment_number\": \"PAY_20260928063151_COFD2L\"}, \"amount\": 42775, \"entity\": \"payment\", \"method\": \"netbanking\", \"status\": \"captured\", \"wallet\": null, \"card_id\": null, \"contact\": \"+916377942673\", \"captured\": true, \"currency\": \"INR\", \"order_id\": \"order_ThMJQrju9xEvcS\", \"created_at\": 1790577120, \"error_code\": null, \"error_step\": null, \"invoice_id\": null, \"description\": \"Payment PAY_20260928063151_COFD2L\", \"error_reason\": null, \"error_source\": null, \"acquirer_data\": {\"bank_transaction_id\": \"1389479\"}, \"international\": false, \"refund_status\": null, \"amount_refunded\": 0, \"error_description\": null}','checkout:2','2026-09-28 01:02:18',NULL,NULL,'2026-09-28 01:01:51','2026-09-28 01:02:18');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payouts`
--

DROP TABLE IF EXISTS `payouts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payouts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payout_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `party_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor_id` bigint unsigned DEFAULT NULL,
  `driver_id` bigint unsigned DEFAULT NULL,
  `delivery_partner_id` bigint unsigned DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `bank_account_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_ifsc` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gateway` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_reference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `mode` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bank_transfer',
  `gateway_response` json DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `idempotency_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failure_reason` text COLLATE utf8mb4_unicode_ci,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payouts_payout_number_unique` (`payout_number`),
  UNIQUE KEY `payouts_idempotency_key_unique` (`idempotency_key`),
  UNIQUE KEY `payouts_provider_reference_unique` (`provider_reference`),
  KEY `payouts_vendor_id_foreign` (`vendor_id`),
  KEY `payouts_driver_id_foreign` (`driver_id`),
  KEY `payouts_delivery_partner_id_foreign` (`delivery_partner_id`),
  KEY `payouts_party_type_status_index` (`party_type`,`status`),
  KEY `payouts_provider_reference_index` (`provider_reference`),
  CONSTRAINT `payouts_delivery_partner_id_foreign` FOREIGN KEY (`delivery_partner_id`) REFERENCES `delivery_partners` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payouts_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payouts_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payouts`
--

LOCK TABLES `payouts` WRITE;
/*!40000 ALTER TABLE `payouts` DISABLE KEYS */;
/*!40000 ALTER TABLE `payouts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `peak_periods`
--

DROP TABLE IF EXISTS `peak_periods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `peak_periods` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `zone_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `day_of_week` enum('all','0','1','2','3','4','5','6') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `surge_multiplier` decimal(4,2) NOT NULL DEFAULT '1.50',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `peak_periods`
--

LOCK TABLES `peak_periods` WRITE;
/*!40000 ALTER TABLE `peak_periods` DISABLE KEYS */;
/*!40000 ALTER TABLE `peak_periods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_name_unique` (`name`),
  UNIQUE KEY `permissions_slug_unique` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=465 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'Dashboard View','dashboard.view','dashboard',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(2,'Dashboard Create','dashboard.create','dashboard',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(3,'Dashboard Update','dashboard.update','dashboard',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(4,'Dashboard Delete','dashboard.delete','dashboard',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(5,'Dashboard Approve','dashboard.approve','dashboard',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(6,'Dashboard Cancel','dashboard.cancel','dashboard',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(7,'Dashboard Refund','dashboard.refund','dashboard',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(8,'Dashboard Adjust','dashboard.adjust','dashboard',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(9,'Dashboard Export','dashboard.export','dashboard',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(10,'Users View','users.view','users',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(11,'Users Create','users.create','users',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(12,'Users Update','users.update','users',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(13,'Users Delete','users.delete','users',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(14,'Users Approve','users.approve','users',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(15,'Users Cancel','users.cancel','users',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(16,'Users Refund','users.refund','users',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(17,'Users Adjust','users.adjust','users',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(18,'Users Export','users.export','users',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(19,'Vendors View','vendors.view','vendors',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(20,'Vendors Create','vendors.create','vendors',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(21,'Vendors Update','vendors.update','vendors',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(22,'Vendors Delete','vendors.delete','vendors',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(23,'Vendors Approve','vendors.approve','vendors',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(24,'Vendors Cancel','vendors.cancel','vendors',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(25,'Vendors Refund','vendors.refund','vendors',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(26,'Vendors Adjust','vendors.adjust','vendors',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(27,'Vendors Export','vendors.export','vendors',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(28,'Restaurants View','restaurants.view','restaurants',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(29,'Restaurants Create','restaurants.create','restaurants',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(30,'Restaurants Update','restaurants.update','restaurants',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(31,'Restaurants Delete','restaurants.delete','restaurants',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(32,'Restaurants Approve','restaurants.approve','restaurants',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(33,'Restaurants Cancel','restaurants.cancel','restaurants',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(34,'Restaurants Refund','restaurants.refund','restaurants',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(35,'Restaurants Adjust','restaurants.adjust','restaurants',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(36,'Restaurants Export','restaurants.export','restaurants',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(37,'Stores View','stores.view','stores',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(38,'Stores Create','stores.create','stores',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(39,'Stores Update','stores.update','stores',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(40,'Stores Delete','stores.delete','stores',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(41,'Stores Approve','stores.approve','stores',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(42,'Stores Cancel','stores.cancel','stores',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(43,'Stores Refund','stores.refund','stores',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(44,'Stores Adjust','stores.adjust','stores',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(45,'Stores Export','stores.export','stores',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(46,'Products View','products.view','products',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(47,'Products Create','products.create','products',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(48,'Products Update','products.update','products',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(49,'Products Delete','products.delete','products',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(50,'Products Approve','products.approve','products',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(51,'Products Cancel','products.cancel','products',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(52,'Products Refund','products.refund','products',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(53,'Products Adjust','products.adjust','products',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(54,'Products Export','products.export','products',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(55,'Categories View','categories.view','categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(56,'Categories Create','categories.create','categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(57,'Categories Update','categories.update','categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(58,'Categories Delete','categories.delete','categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(59,'Categories Approve','categories.approve','categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(60,'Categories Cancel','categories.cancel','categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(61,'Categories Refund','categories.refund','categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(62,'Categories Adjust','categories.adjust','categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(63,'Categories Export','categories.export','categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(64,'Vendor_categories View','vendor_categories.view','vendor_categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(65,'Vendor_categories Create','vendor_categories.create','vendor_categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(66,'Vendor_categories Update','vendor_categories.update','vendor_categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(67,'Vendor_categories Delete','vendor_categories.delete','vendor_categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(68,'Vendor_categories Approve','vendor_categories.approve','vendor_categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(69,'Vendor_categories Cancel','vendor_categories.cancel','vendor_categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(70,'Vendor_categories Refund','vendor_categories.refund','vendor_categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(71,'Vendor_categories Adjust','vendor_categories.adjust','vendor_categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(72,'Vendor_categories Export','vendor_categories.export','vendor_categories',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(73,'Orders View','orders.view','orders',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(74,'Orders Create','orders.create','orders',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(75,'Orders Update','orders.update','orders',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(76,'Orders Delete','orders.delete','orders',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(77,'Orders Approve','orders.approve','orders',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(78,'Orders Cancel','orders.cancel','orders',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(79,'Orders Refund','orders.refund','orders',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(80,'Orders Adjust','orders.adjust','orders',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(81,'Orders Export','orders.export','orders',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(82,'Rides View','rides.view','rides',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(83,'Rides Create','rides.create','rides',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(84,'Rides Update','rides.update','rides',NULL,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(85,'Rides Delete','rides.delete','rides',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(86,'Rides Approve','rides.approve','rides',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(87,'Rides Cancel','rides.cancel','rides',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(88,'Rides Refund','rides.refund','rides',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(89,'Rides Adjust','rides.adjust','rides',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(90,'Rides Export','rides.export','rides',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(91,'Drivers View','drivers.view','drivers',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(92,'Drivers Create','drivers.create','drivers',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(93,'Drivers Update','drivers.update','drivers',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(94,'Drivers Delete','drivers.delete','drivers',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(95,'Drivers Approve','drivers.approve','drivers',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(96,'Drivers Cancel','drivers.cancel','drivers',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(97,'Drivers Refund','drivers.refund','drivers',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(98,'Drivers Adjust','drivers.adjust','drivers',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(99,'Drivers Export','drivers.export','drivers',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(100,'Delivery_partners View','delivery_partners.view','delivery_partners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(101,'Delivery_partners Create','delivery_partners.create','delivery_partners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(102,'Delivery_partners Update','delivery_partners.update','delivery_partners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(103,'Delivery_partners Delete','delivery_partners.delete','delivery_partners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(104,'Delivery_partners Approve','delivery_partners.approve','delivery_partners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(105,'Delivery_partners Cancel','delivery_partners.cancel','delivery_partners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(106,'Delivery_partners Refund','delivery_partners.refund','delivery_partners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(107,'Delivery_partners Adjust','delivery_partners.adjust','delivery_partners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(108,'Delivery_partners Export','delivery_partners.export','delivery_partners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(109,'Wallet View','wallet.view','wallet',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(110,'Wallet Create','wallet.create','wallet',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(111,'Wallet Update','wallet.update','wallet',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(112,'Wallet Delete','wallet.delete','wallet',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(113,'Wallet Approve','wallet.approve','wallet',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(114,'Wallet Cancel','wallet.cancel','wallet',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(115,'Wallet Refund','wallet.refund','wallet',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(116,'Wallet Adjust','wallet.adjust','wallet',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(117,'Wallet Export','wallet.export','wallet',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(118,'Transactions View','transactions.view','transactions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(119,'Transactions Create','transactions.create','transactions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(120,'Transactions Update','transactions.update','transactions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(121,'Transactions Delete','transactions.delete','transactions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(122,'Transactions Approve','transactions.approve','transactions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(123,'Transactions Cancel','transactions.cancel','transactions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(124,'Transactions Refund','transactions.refund','transactions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(125,'Transactions Adjust','transactions.adjust','transactions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(126,'Transactions Export','transactions.export','transactions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(127,'Commissions View','commissions.view','commissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(128,'Commissions Create','commissions.create','commissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(129,'Commissions Update','commissions.update','commissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(130,'Commissions Delete','commissions.delete','commissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(131,'Commissions Approve','commissions.approve','commissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(132,'Commissions Cancel','commissions.cancel','commissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(133,'Commissions Refund','commissions.refund','commissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(134,'Commissions Adjust','commissions.adjust','commissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(135,'Commissions Export','commissions.export','commissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(136,'Settlements View','settlements.view','settlements',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(137,'Settlements Create','settlements.create','settlements',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(138,'Settlements Update','settlements.update','settlements',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(139,'Settlements Delete','settlements.delete','settlements',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(140,'Settlements Approve','settlements.approve','settlements',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(141,'Settlements Cancel','settlements.cancel','settlements',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(142,'Settlements Refund','settlements.refund','settlements',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(143,'Settlements Adjust','settlements.adjust','settlements',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(144,'Settlements Export','settlements.export','settlements',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(145,'Payouts View','payouts.view','payouts',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(146,'Payouts Create','payouts.create','payouts',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(147,'Payouts Update','payouts.update','payouts',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(148,'Payouts Delete','payouts.delete','payouts',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(149,'Payouts Approve','payouts.approve','payouts',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(150,'Payouts Cancel','payouts.cancel','payouts',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(151,'Payouts Refund','payouts.refund','payouts',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(152,'Payouts Adjust','payouts.adjust','payouts',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(153,'Payouts Export','payouts.export','payouts',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(154,'Coupons View','coupons.view','coupons',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(155,'Coupons Create','coupons.create','coupons',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(156,'Coupons Update','coupons.update','coupons',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(157,'Coupons Delete','coupons.delete','coupons',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(158,'Coupons Approve','coupons.approve','coupons',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(159,'Coupons Cancel','coupons.cancel','coupons',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(160,'Coupons Refund','coupons.refund','coupons',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(161,'Coupons Adjust','coupons.adjust','coupons',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(162,'Coupons Export','coupons.export','coupons',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(163,'Promotions View','promotions.view','promotions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(164,'Promotions Create','promotions.create','promotions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(165,'Promotions Update','promotions.update','promotions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(166,'Promotions Delete','promotions.delete','promotions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(167,'Promotions Approve','promotions.approve','promotions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(168,'Promotions Cancel','promotions.cancel','promotions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(169,'Promotions Refund','promotions.refund','promotions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(170,'Promotions Adjust','promotions.adjust','promotions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(171,'Promotions Export','promotions.export','promotions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(172,'Campaigns View','campaigns.view','campaigns',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(173,'Campaigns Create','campaigns.create','campaigns',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(174,'Campaigns Update','campaigns.update','campaigns',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(175,'Campaigns Delete','campaigns.delete','campaigns',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(176,'Campaigns Approve','campaigns.approve','campaigns',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(177,'Campaigns Cancel','campaigns.cancel','campaigns',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(178,'Campaigns Refund','campaigns.refund','campaigns',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(179,'Campaigns Adjust','campaigns.adjust','campaigns',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(180,'Campaigns Export','campaigns.export','campaigns',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(181,'Loyalty View','loyalty.view','loyalty',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(182,'Loyalty Create','loyalty.create','loyalty',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(183,'Loyalty Update','loyalty.update','loyalty',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(184,'Loyalty Delete','loyalty.delete','loyalty',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(185,'Loyalty Approve','loyalty.approve','loyalty',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(186,'Loyalty Cancel','loyalty.cancel','loyalty',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(187,'Loyalty Refund','loyalty.refund','loyalty',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(188,'Loyalty Adjust','loyalty.adjust','loyalty',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(189,'Loyalty Export','loyalty.export','loyalty',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(190,'Referrals View','referrals.view','referrals',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(191,'Referrals Create','referrals.create','referrals',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(192,'Referrals Update','referrals.update','referrals',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(193,'Referrals Delete','referrals.delete','referrals',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(194,'Referrals Approve','referrals.approve','referrals',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(195,'Referrals Cancel','referrals.cancel','referrals',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(196,'Referrals Refund','referrals.refund','referrals',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(197,'Referrals Adjust','referrals.adjust','referrals',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(198,'Referrals Export','referrals.export','referrals',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(199,'Reviews View','reviews.view','reviews',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(200,'Reviews Create','reviews.create','reviews',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(201,'Reviews Update','reviews.update','reviews',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(202,'Reviews Delete','reviews.delete','reviews',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(203,'Reviews Approve','reviews.approve','reviews',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(204,'Reviews Cancel','reviews.cancel','reviews',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(205,'Reviews Refund','reviews.refund','reviews',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(206,'Reviews Adjust','reviews.adjust','reviews',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(207,'Reviews Export','reviews.export','reviews',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(208,'Support View','support.view','support',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(209,'Support Create','support.create','support',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(210,'Support Update','support.update','support',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(211,'Support Delete','support.delete','support',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(212,'Support Approve','support.approve','support',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(213,'Support Cancel','support.cancel','support',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(214,'Support Refund','support.refund','support',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(215,'Support Adjust','support.adjust','support',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(216,'Support Export','support.export','support',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(217,'Notifications View','notifications.view','notifications',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(218,'Notifications Create','notifications.create','notifications',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(219,'Notifications Update','notifications.update','notifications',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(220,'Notifications Delete','notifications.delete','notifications',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(221,'Notifications Approve','notifications.approve','notifications',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(222,'Notifications Cancel','notifications.cancel','notifications',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(223,'Notifications Refund','notifications.refund','notifications',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(224,'Notifications Adjust','notifications.adjust','notifications',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(225,'Notifications Export','notifications.export','notifications',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(226,'Cms View','cms.view','cms',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(227,'Cms Create','cms.create','cms',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(228,'Cms Update','cms.update','cms',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(229,'Cms Delete','cms.delete','cms',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(230,'Cms Approve','cms.approve','cms',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(231,'Cms Cancel','cms.cancel','cms',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(232,'Cms Refund','cms.refund','cms',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(233,'Cms Adjust','cms.adjust','cms',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(234,'Cms Export','cms.export','cms',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(235,'Banners View','banners.view','banners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(236,'Banners Create','banners.create','banners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(237,'Banners Update','banners.update','banners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(238,'Banners Delete','banners.delete','banners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(239,'Banners Approve','banners.approve','banners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(240,'Banners Cancel','banners.cancel','banners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(241,'Banners Refund','banners.refund','banners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(242,'Banners Adjust','banners.adjust','banners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(243,'Banners Export','banners.export','banners',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(244,'Settings View','settings.view','settings',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(245,'Settings Create','settings.create','settings',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(246,'Settings Update','settings.update','settings',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(247,'Settings Delete','settings.delete','settings',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(248,'Settings Approve','settings.approve','settings',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(249,'Settings Cancel','settings.cancel','settings',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(250,'Settings Refund','settings.refund','settings',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(251,'Settings Adjust','settings.adjust','settings',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(252,'Settings Export','settings.export','settings',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(253,'Integrations View','integrations.view','integrations',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(254,'Integrations Create','integrations.create','integrations',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(255,'Integrations Update','integrations.update','integrations',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(256,'Integrations Delete','integrations.delete','integrations',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(257,'Integrations Approve','integrations.approve','integrations',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(258,'Integrations Cancel','integrations.cancel','integrations',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(259,'Integrations Refund','integrations.refund','integrations',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(260,'Integrations Adjust','integrations.adjust','integrations',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(261,'Integrations Export','integrations.export','integrations',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(262,'Zones View','zones.view','zones',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(263,'Zones Create','zones.create','zones',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(264,'Zones Update','zones.update','zones',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(265,'Zones Delete','zones.delete','zones',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(266,'Zones Approve','zones.approve','zones',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(267,'Zones Cancel','zones.cancel','zones',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(268,'Zones Refund','zones.refund','zones',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(269,'Zones Adjust','zones.adjust','zones',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(270,'Zones Export','zones.export','zones',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(271,'Vehicles View','vehicles.view','vehicles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(272,'Vehicles Create','vehicles.create','vehicles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(273,'Vehicles Update','vehicles.update','vehicles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(274,'Vehicles Delete','vehicles.delete','vehicles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(275,'Vehicles Approve','vehicles.approve','vehicles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(276,'Vehicles Cancel','vehicles.cancel','vehicles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(277,'Vehicles Refund','vehicles.refund','vehicles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(278,'Vehicles Adjust','vehicles.adjust','vehicles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(279,'Vehicles Export','vehicles.export','vehicles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(280,'Documents View','documents.view','documents',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(281,'Documents Create','documents.create','documents',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(282,'Documents Update','documents.update','documents',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(283,'Documents Delete','documents.delete','documents',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(284,'Documents Approve','documents.approve','documents',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(285,'Documents Cancel','documents.cancel','documents',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(286,'Documents Refund','documents.refund','documents',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(287,'Documents Adjust','documents.adjust','documents',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(288,'Documents Export','documents.export','documents',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(289,'Kyc View','kyc.view','kyc',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(290,'Kyc Create','kyc.create','kyc',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(291,'Kyc Update','kyc.update','kyc',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(292,'Kyc Delete','kyc.delete','kyc',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(293,'Kyc Approve','kyc.approve','kyc',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(294,'Kyc Cancel','kyc.cancel','kyc',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(295,'Kyc Refund','kyc.refund','kyc',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(296,'Kyc Adjust','kyc.adjust','kyc',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(297,'Kyc Export','kyc.export','kyc',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(298,'Reports View','reports.view','reports',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(299,'Reports Create','reports.create','reports',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(300,'Reports Update','reports.update','reports',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(301,'Reports Delete','reports.delete','reports',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(302,'Reports Approve','reports.approve','reports',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(303,'Reports Cancel','reports.cancel','reports',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(304,'Reports Refund','reports.refund','reports',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(305,'Reports Adjust','reports.adjust','reports',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(306,'Reports Export','reports.export','reports',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(307,'Analytics View','analytics.view','analytics',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(308,'Analytics Create','analytics.create','analytics',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(309,'Analytics Update','analytics.update','analytics',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(310,'Analytics Delete','analytics.delete','analytics',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(311,'Analytics Approve','analytics.approve','analytics',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(312,'Analytics Cancel','analytics.cancel','analytics',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(313,'Analytics Refund','analytics.refund','analytics',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(314,'Analytics Adjust','analytics.adjust','analytics',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(315,'Analytics Export','analytics.export','analytics',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(316,'Audit_logs View','audit_logs.view','audit_logs',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(317,'Audit_logs Create','audit_logs.create','audit_logs',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(318,'Audit_logs Update','audit_logs.update','audit_logs',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(319,'Audit_logs Delete','audit_logs.delete','audit_logs',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(320,'Audit_logs Approve','audit_logs.approve','audit_logs',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(321,'Audit_logs Cancel','audit_logs.cancel','audit_logs',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(322,'Audit_logs Refund','audit_logs.refund','audit_logs',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(323,'Audit_logs Adjust','audit_logs.adjust','audit_logs',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(324,'Audit_logs Export','audit_logs.export','audit_logs',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(325,'Roles View','roles.view','roles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(326,'Roles Create','roles.create','roles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(327,'Roles Update','roles.update','roles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(328,'Roles Delete','roles.delete','roles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(329,'Roles Approve','roles.approve','roles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(330,'Roles Cancel','roles.cancel','roles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(331,'Roles Refund','roles.refund','roles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(332,'Roles Adjust','roles.adjust','roles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(333,'Roles Export','roles.export','roles',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(334,'Permissions View','permissions.view','permissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(335,'Permissions Create','permissions.create','permissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(336,'Permissions Update','permissions.update','permissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(337,'Permissions Delete','permissions.delete','permissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(338,'Permissions Approve','permissions.approve','permissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(339,'Permissions Cancel','permissions.cancel','permissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(340,'Permissions Refund','permissions.refund','permissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(341,'Permissions Adjust','permissions.adjust','permissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(342,'Permissions Export','permissions.export','permissions',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(343,'Feature_flags View','feature_flags.view','feature_flags',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(344,'Feature_flags Create','feature_flags.create','feature_flags',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(345,'Feature_flags Update','feature_flags.update','feature_flags',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(346,'Feature_flags Delete','feature_flags.delete','feature_flags',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(347,'Feature_flags Approve','feature_flags.approve','feature_flags',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(348,'Feature_flags Cancel','feature_flags.cancel','feature_flags',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(349,'Feature_flags Refund','feature_flags.refund','feature_flags',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(350,'Feature_flags Adjust','feature_flags.adjust','feature_flags',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(351,'Feature_flags Export','feature_flags.export','feature_flags',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(352,'Incentives View','incentives.view','incentives',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(353,'Incentives Create','incentives.create','incentives',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(354,'Incentives Update','incentives.update','incentives',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(355,'Incentives Delete','incentives.delete','incentives',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(356,'Incentives Approve','incentives.approve','incentives',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(357,'Incentives Cancel','incentives.cancel','incentives',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(358,'Incentives Refund','incentives.refund','incentives',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(359,'Incentives Adjust','incentives.adjust','incentives',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(360,'Incentives Export','incentives.export','incentives',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(361,'Pricing View','pricing.view','pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(362,'Pricing Create','pricing.create','pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(363,'Pricing Update','pricing.update','pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(364,'Pricing Delete','pricing.delete','pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(365,'Pricing Approve','pricing.approve','pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(366,'Pricing Cancel','pricing.cancel','pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(367,'Pricing Refund','pricing.refund','pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(368,'Pricing Adjust','pricing.adjust','pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(369,'Pricing Export','pricing.export','pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(370,'Surge_pricing View','surge_pricing.view','surge_pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(371,'Surge_pricing Create','surge_pricing.create','surge_pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(372,'Surge_pricing Update','surge_pricing.update','surge_pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(373,'Surge_pricing Delete','surge_pricing.delete','surge_pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(374,'Surge_pricing Approve','surge_pricing.approve','surge_pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(375,'Surge_pricing Cancel','surge_pricing.cancel','surge_pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(376,'Surge_pricing Refund','surge_pricing.refund','surge_pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(377,'Surge_pricing Adjust','surge_pricing.adjust','surge_pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(378,'Surge_pricing Export','surge_pricing.export','surge_pricing',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(379,'Taxes View','taxes.view','taxes',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(380,'Taxes Create','taxes.create','taxes',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(381,'Taxes Update','taxes.update','taxes',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(382,'Taxes Delete','taxes.delete','taxes',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(383,'Taxes Approve','taxes.approve','taxes',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(384,'Taxes Cancel','taxes.cancel','taxes',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(385,'Taxes Refund','taxes.refund','taxes',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(386,'Taxes Adjust','taxes.adjust','taxes',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(387,'Taxes Export','taxes.export','taxes',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(388,'Delivery_config View','delivery_config.view','delivery_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(389,'Delivery_config Create','delivery_config.create','delivery_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(390,'Delivery_config Update','delivery_config.update','delivery_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(391,'Delivery_config Delete','delivery_config.delete','delivery_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(392,'Delivery_config Approve','delivery_config.approve','delivery_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(393,'Delivery_config Cancel','delivery_config.cancel','delivery_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(394,'Delivery_config Refund','delivery_config.refund','delivery_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(395,'Delivery_config Adjust','delivery_config.adjust','delivery_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(396,'Delivery_config Export','delivery_config.export','delivery_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(397,'Ride_config View','ride_config.view','ride_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(398,'Ride_config Create','ride_config.create','ride_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(399,'Ride_config Update','ride_config.update','ride_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(400,'Ride_config Delete','ride_config.delete','ride_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(401,'Ride_config Approve','ride_config.approve','ride_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(402,'Ride_config Cancel','ride_config.cancel','ride_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(403,'Ride_config Refund','ride_config.refund','ride_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(404,'Ride_config Adjust','ride_config.adjust','ride_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(405,'Ride_config Export','ride_config.export','ride_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(406,'Payment_config View','payment_config.view','payment_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(407,'Payment_config Create','payment_config.create','payment_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(408,'Payment_config Update','payment_config.update','payment_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(409,'Payment_config Delete','payment_config.delete','payment_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(410,'Payment_config Approve','payment_config.approve','payment_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(411,'Payment_config Cancel','payment_config.cancel','payment_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(412,'Payment_config Refund','payment_config.refund','payment_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(413,'Payment_config Adjust','payment_config.adjust','payment_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(414,'Payment_config Export','payment_config.export','payment_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(415,'Maps_config View','maps_config.view','maps_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(416,'Maps_config Create','maps_config.create','maps_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(417,'Maps_config Update','maps_config.update','maps_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(418,'Maps_config Delete','maps_config.delete','maps_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(419,'Maps_config Approve','maps_config.approve','maps_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(420,'Maps_config Cancel','maps_config.cancel','maps_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(421,'Maps_config Refund','maps_config.refund','maps_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(422,'Maps_config Adjust','maps_config.adjust','maps_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(423,'Maps_config Export','maps_config.export','maps_config',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(424,'Languages View','languages.view','languages',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(425,'Languages Create','languages.create','languages',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(426,'Languages Update','languages.update','languages',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(427,'Languages Delete','languages.delete','languages',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(428,'Languages Approve','languages.approve','languages',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(429,'Languages Cancel','languages.cancel','languages',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(430,'Languages Refund','languages.refund','languages',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(431,'Languages Adjust','languages.adjust','languages',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(432,'Languages Export','languages.export','languages',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(433,'Currencies View','currencies.view','currencies',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(434,'Currencies Create','currencies.create','currencies',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(435,'Currencies Update','currencies.update','currencies',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(436,'Currencies Delete','currencies.delete','currencies',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(437,'Currencies Approve','currencies.approve','currencies',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(438,'Currencies Cancel','currencies.cancel','currencies',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(439,'Currencies Refund','currencies.refund','currencies',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(440,'Currencies Adjust','currencies.adjust','currencies',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(441,'Currencies Export','currencies.export','currencies',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(442,'Countries View','countries.view','countries',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(443,'Countries Create','countries.create','countries',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(444,'Countries Update','countries.update','countries',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(445,'Countries Delete','countries.delete','countries',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(446,'Countries Approve','countries.approve','countries',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(447,'Countries Cancel','countries.cancel','countries',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(448,'Countries Refund','countries.refund','countries',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(449,'Countries Adjust','countries.adjust','countries',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(450,'Countries Export','countries.export','countries',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(451,'Cities View','cities.view','cities',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(452,'Cities Create','cities.create','cities',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(453,'Cities Update','cities.update','cities',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(454,'Cities Delete','cities.delete','cities',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(455,'Cities Approve','cities.approve','cities',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(456,'Cities Cancel','cities.cancel','cities',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(457,'Cities Refund','cities.refund','cities',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(458,'Cities Adjust','cities.adjust','cities',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(459,'Cities Export','cities.export','cities',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(460,'Categories Restore','categories.restore','categories',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(461,'Categories Reorder','categories.reorder','categories',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(462,'Categories Feature','categories.feature','categories',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(463,'Vendor Categories Restore','vendor_categories.restore','vendor_categories',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13'),(464,'Vendor Categories Reorder','vendor_categories.reorder','vendor_categories',NULL,'2026-09-18 04:12:13','2026-09-18 04:12:13');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint unsigned NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abilities` text COLLATE utf8mb4_unicode_ci,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=165 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (3,'App\\Models\\User',62,'auth_VzZGcl5n','8c7561f931df2d8ef516391cea2f03070bb1d3053713486b1e1422567a28c1e2','[\"*\"]','2026-09-18 04:17:46',NULL,'2026-09-18 04:15:00','2026-09-18 04:17:46'),(4,'App\\Models\\User',63,'auth_0bNDWC3U','8d95c9440387d22ef9daf12d96b95a43083de87a921250818dff3bfeac5e328b','[\"*\"]','2026-09-18 05:52:23',NULL,'2026-09-18 05:20:05','2026-09-18 05:52:23'),(5,'App\\Models\\User',63,'auth_XMng9X6W','1e48ac5605d44583041362fd079a1f3c59e353e25214fbcbfac19b6d0c8cf23d','[\"*\"]','2026-09-18 05:52:35',NULL,'2026-09-18 05:52:26','2026-09-18 05:52:35'),(6,'App\\Models\\User',63,'auth_pBwNy6Bk','d433dbd3d145cf5c64165aa80bbaa412d828a39015ff36a40fb6246fb20c9eee','[\"*\"]','2026-09-18 06:31:01',NULL,'2026-09-18 05:52:38','2026-09-18 06:31:01'),(7,'App\\Models\\User',63,'auth_06NVijWq','9c11fdd7e4f5423f9a9ec9834db16da4a3e1d50383e3f41d36e17d8719a5d0eb','[\"*\"]','2026-09-18 06:31:19',NULL,'2026-09-18 06:31:03','2026-09-18 06:31:19'),(8,'App\\Models\\User',63,'auth_3c0GITId','9a506b7dfcd371450ee487cfc5fa8637e4dc2b7cc5364be8a4f4bb20170265b5','[\"*\"]','2026-09-18 06:47:40',NULL,'2026-09-18 06:31:32','2026-09-18 06:47:40'),(11,'App\\Models\\User',65,'auth_Pc0Gi9ej','ea3b476b26d3afa12b88ff904c1ed53d428bd641581acf4b4daeb773c4ddc387','[\"*\"]','2026-09-18 06:54:16',NULL,'2026-09-18 06:49:26','2026-09-18 06:54:16'),(12,'App\\Models\\User',17,'auth_QiXvo4xB','36e9db5f604126e7c19d759a5d0e07f71731d3abe57ec18e742cf7b2001a01fd','[\"*\"]','2026-09-18 06:59:50',NULL,'2026-09-18 06:54:22','2026-09-18 06:59:50'),(13,'App\\Models\\User',66,'auth_XBfaduHf','9bddaaf1d2096b88c629edfaf772bf26cfcbe2afb01d005485fc217debafb953','[\"*\"]','2026-09-20 22:43:08',NULL,'2026-09-18 07:01:42','2026-09-20 22:43:08'),(14,'App\\Models\\User',65,'auth_rcGldFAz','6ed85da759d50064c25abdd6cfff6e115d990174aa7d73a69534160cc07d0d04','[\"*\"]','2026-09-20 22:53:10',NULL,'2026-09-20 22:43:25','2026-09-20 22:53:10'),(16,'App\\Models\\User',63,'auth_Y6F6IqFf','747e14e061af3818233c1492ccbd56bb1d382ddac52c6b6bead7bf0cb7a7ac97','[\"*\"]','2026-09-20 22:54:27',NULL,'2026-09-20 22:53:17','2026-09-20 22:54:27'),(17,'App\\Models\\User',66,'auth_R3lDGv2E','3cdcdb2ba1e67bef84e78a2349996955d9847ee778f170cecf19856925d65daa','[\"*\"]','2026-09-21 00:31:46',NULL,'2026-09-20 22:55:15','2026-09-21 00:31:46'),(18,'App\\Models\\User',63,'auth_B5NpoDAo','6c3ca6151d44a43be3d50ff39d2b6b3e1c0bd8ce7490f06a38ecded04cdeae75','[\"*\"]','2026-09-21 00:45:28',NULL,'2026-09-21 00:31:54','2026-09-21 00:45:28'),(21,'App\\Models\\User',65,'auth_z4LBHUeZ','a515a88f08a6ffe8144bea79a71cc16052af0172936faf89b399abddae4d468b','[\"*\"]','2026-09-21 00:55:43',NULL,'2026-09-21 00:46:00','2026-09-21 00:55:43'),(22,'App\\Models\\User',66,'auth_WgQSyJ7l','b5f5302a1391b72fa4b355f71b94cb48854e2f8df0e42caa7722c9c880122647','[\"*\"]','2026-09-21 00:56:44',NULL,'2026-09-21 00:55:58','2026-09-21 00:56:44'),(23,'App\\Models\\User',67,'auth_INcxdokb','8d8d43ffa60d0d8d3e2b3d88c2e279ca9bfe20d41b091571fc8d36011ec59dbf','[\"*\"]','2026-09-21 00:59:20',NULL,'2026-09-21 00:58:43','2026-09-21 00:59:20'),(24,'App\\Models\\User',67,'auth_x0B8fLA9','7e7a955c45ab80216dabd6d5c4426a0688dca78a3a327997821ba88f5b8f94c2','[\"*\"]','2026-09-21 01:02:53',NULL,'2026-09-21 00:59:24','2026-09-21 01:02:53'),(25,'App\\Models\\User',66,'auth_ccKRZzkK','2897bbe176a2f1e117c77ce859154e74f70fd93b80dec047767d161d2a405b6a','[\"*\"]','2026-09-21 01:03:11',NULL,'2026-09-21 01:03:05','2026-09-21 01:03:11'),(26,'App\\Models\\User',66,'auth_hHgE2Cp3','fa06510b8275f20699ec3308ed7021852b0094a84a03f7756cd5f5678b420c56','[\"*\"]','2026-09-21 04:51:48',NULL,'2026-09-21 01:03:14','2026-09-21 04:51:48'),(28,'App\\Models\\User',13,'auth_I9qKjCME','73cee17726ddf105ccf1811ec13a3de06e6d02c9357e63712d6e8968ca593487','[\"*\"]','2026-09-28 00:43:16',NULL,'2026-09-21 03:21:55','2026-09-28 00:43:16'),(31,'App\\Models\\User',63,'auth_zS5cMtni','6830fbf324d5315fc13bf6c3b4cb1f8c14ea2f919ab6d71a20aa1573ba5757be','[\"*\"]','2026-09-21 06:27:13',NULL,'2026-09-21 04:51:55','2026-09-21 06:27:13'),(32,'App\\Models\\User',69,'auth_vPVE7Yr8','a931830ed5fd7412c73f4769c50ed0f9743f94151aa88a17e6d4cd84836f5781','[\"*\"]','2026-09-21 05:05:38',NULL,'2026-09-21 05:05:38','2026-09-21 05:05:38'),(33,'App\\Models\\User',70,'auth_vL47YTYb','6973884ec06a6786383ed14e213c7534062618b1f815e92c53a919d5fa2b653d','[\"*\"]','2026-09-21 05:07:59',NULL,'2026-09-21 05:07:58','2026-09-21 05:07:59'),(34,'App\\Models\\User',70,'auth_pJwaPsRn','77c7c720e3d25b150f4310283b4865d9de42b499d44e90e806cc65b3ebcfbfd1','[\"*\"]','2026-09-21 05:08:11',NULL,'2026-09-21 05:08:11','2026-09-21 05:08:11'),(37,'App\\Models\\User',65,'auth_Zc8E9TIv','b5e1ce2387f0e4afae6356fc19286a4d6bc05aa8665eae600affac2be6c8dd12','[\"*\"]','2026-09-21 06:27:27',NULL,'2026-09-21 06:27:22','2026-09-21 06:27:27'),(38,'App\\Models\\User',65,'auth_oHMrhOo6','afdf8e95b8c6fdafa237b1ebb36ce47475d93f724d746dcc577c397f6b077714','[\"*\"]','2026-09-21 07:04:53',NULL,'2026-09-21 06:27:33','2026-09-21 07:04:53'),(39,'App\\Models\\User',66,'auth_y02gFubf','fa8a991f91be1e97de2a962f3c7e246283ead680e252450c9f32edeb65a33e0d','[\"*\"]','2026-09-21 07:05:14',NULL,'2026-09-21 07:05:04','2026-09-21 07:05:14'),(40,'App\\Models\\User',66,'auth_ti7UIZOV','3a0c49b36affb1d817f3416aee2fcacdc1ef8437a31bf801fbacfc6542b7e459','[\"*\"]','2026-09-21 07:07:39',NULL,'2026-09-21 07:05:17','2026-09-21 07:07:39'),(41,'App\\Models\\User',66,'auth_8F0RHwPJ','50ad3b9027226d13f00b77f2d7f61b9fe81bd6c1e2b1e0af3484e9444f7af303','[\"*\"]','2026-09-21 07:08:25',NULL,'2026-09-21 07:07:41','2026-09-21 07:08:25'),(42,'App\\Models\\User',66,'auth_rbdDrIio','14c3e13d007391671ab2855d73edc11375674fa98eccd19a6c7e369569d2f452','[\"*\"]','2026-09-21 07:09:33',NULL,'2026-09-21 07:08:28','2026-09-21 07:09:33'),(43,'App\\Models\\User',66,'auth_fiqtMZzQ','aa15d4e9d00deb75e7f478c2333e2bde0628e40feb07de49529ee021cbda9357','[\"*\"]','2026-09-21 07:22:15',NULL,'2026-09-21 07:09:48','2026-09-21 07:22:15'),(44,'App\\Models\\User',67,'auth_m2Ybqfqp','19611cfd4a33ce1df201357ef93e93cc6bd19ccbfb3732fc672a02256f363ce2','[\"*\"]','2026-09-21 07:22:24',NULL,'2026-09-21 07:22:18','2026-09-21 07:22:24'),(45,'App\\Models\\User',66,'auth_8mbyhQMV','c40cd9f1a7197297d2245b0b504f3763bdb41a50af6086129a0397ad5f300a78','[\"*\"]','2026-09-21 22:50:20',NULL,'2026-09-21 07:22:29','2026-09-21 22:50:20'),(46,'App\\Models\\User',63,'auth_hNwiWDMy','2ab068bb3c5c67eb464ce52e8135a695954f490ff957dcce621d31c288552e37','[\"*\"]','2026-09-22 02:50:11',NULL,'2026-09-21 22:50:38','2026-09-22 02:50:11'),(47,'App\\Models\\User',15,'auth_IhN8eNOn','95ff78c9056027fc71b0312570989359388f5934c5e00b9f5c47faefac998ded','[\"*\"]','2026-09-22 03:38:36',NULL,'2026-09-21 23:09:24','2026-09-22 03:38:36'),(48,'App\\Models\\User',63,'auth_TLJHxGtR','7680755f33cdbabb41aba55283556bb0c63034a1eba41aa1abf8822b173ce953','[\"*\"]','2026-09-22 03:09:21',NULL,'2026-09-22 02:50:14','2026-09-22 03:09:21'),(49,'App\\Models\\User',63,'auth_AYYjDq1C','83aad576e09bf07b9945f05e25a79412322e843547291b6e58e7989a85d22c46','[\"*\"]','2026-09-22 06:50:40',NULL,'2026-09-22 03:09:25','2026-09-22 06:50:40'),(51,'App\\Models\\User',65,'auth_mhwq0uxX','2aeff8e4405ad2eb03187367fef9b529c64a41fe28cd3993982eca24026db3ad','[\"*\"]','2026-09-22 06:51:06',NULL,'2026-09-22 06:50:47','2026-09-22 06:51:06'),(52,'App\\Models\\User',63,'auth_50PjvfvR','6910804b491598bdc7afba3d97f077a524022e31da5e521ca2e8c8daf46bc965','[\"*\"]','2026-09-22 23:14:28',NULL,'2026-09-22 06:51:10','2026-09-22 23:14:28'),(53,'App\\Models\\User',63,'manual-otp-test','1577c923f24d7a1db2e17cbf6532fa7bc82dc29c3b0f27ea0c66c0c66e04e116','[\"*\"]','2026-09-22 07:08:01',NULL,'2026-09-22 07:05:43','2026-09-22 07:08:01'),(55,'App\\Models\\User',65,'auth_gs4IZGPK','80cabb554b2268d88d3e5887e7807dcc65081df763435e36a127a74e145af636','[\"*\"]','2026-09-22 23:38:30',NULL,'2026-09-22 23:14:37','2026-09-22 23:38:30'),(56,'App\\Models\\User',63,'auth_wJnOQj3s','4779ab8c46dce8e3ee252ed27a6301c33667e42ed92e709b65c27de37feea6f6','[\"*\"]','2026-09-22 23:38:43',NULL,'2026-09-22 23:38:38','2026-09-22 23:38:43'),(57,'App\\Models\\User',65,'auth_h95ZIAD2','738aba05c4c5d1d95ca083f7e10e84a0c19487302bcc8d7c955870513c824a25','[\"*\"]','2026-09-22 23:38:59',NULL,'2026-09-22 23:38:51','2026-09-22 23:38:59'),(58,'App\\Models\\User',66,'auth_XC8jVoE1','729c0bb128a6767370227fa7f19726dce3b9519646b2c47e28942be81ee2d98b','[\"*\"]','2026-09-22 23:39:12',NULL,'2026-09-22 23:39:05','2026-09-22 23:39:12'),(59,'App\\Models\\User',63,'auth_Cy81lkoq','47494d42ca411d517fdacae1efa1fe6352921a5cfd981354278750106bda0546','[\"*\"]','2026-09-23 03:02:08',NULL,'2026-09-22 23:39:18','2026-09-23 03:02:08'),(61,'App\\Models\\User',65,'auth_UoMbdCJc','72add87cdd4ee243bbd22756666f326bee3e4cc0090f582510c8a15c6bce2367','[\"*\"]','2026-09-23 03:55:11',NULL,'2026-09-23 03:02:23','2026-09-23 03:55:11'),(62,'App\\Models\\User',63,'auth_ZQH26R3I','2a567e8aa722780aa796b70794d99ae31d748408bc6fd03163572e024f5445df','[\"*\"]','2026-09-23 03:55:23',NULL,'2026-09-23 03:55:16','2026-09-23 03:55:23'),(63,'App\\Models\\User',66,'auth_UjrqQEjS','980c0a8c244ee950a9df55714684af18af9b5248805064d0875a3c663a969e63','[\"*\"]','2026-09-23 03:58:40',NULL,'2026-09-23 03:55:34','2026-09-23 03:58:40'),(64,'App\\Models\\User',67,'auth_c3eVXdGC','58ff1a3b6febf9f8b69df1ed36d2ddb08114d8c17368a3a1fde77002fdacd781','[\"*\"]','2026-09-23 03:58:55',NULL,'2026-09-23 03:58:49','2026-09-23 03:58:55'),(65,'App\\Models\\User',63,'auth_n0a74AzZ','4d03ff35dca0a479ed69419e2010c215289a81be3178da077906e20188ab2470','[\"*\"]','2026-09-23 03:59:04',NULL,'2026-09-23 03:59:00','2026-09-23 03:59:04'),(66,'App\\Models\\User',66,'auth_LYY2ycQF','cce108428a30b6a5d666a4ade55f0356f552d3881505c2116b727d4c224470f3','[\"*\"]','2026-09-23 04:21:16',NULL,'2026-09-23 03:59:14','2026-09-23 04:21:16'),(68,'App\\Models\\User',63,'auth_gNwvnvSJ','18c41c59a2c3944b0aaf667ec9dfb4a99972cf030c70d8c991d6aa7f9305daf8','[\"*\"]','2026-09-23 04:28:07',NULL,'2026-09-23 04:21:21','2026-09-23 04:28:07'),(69,'App\\Models\\User',65,'auth_FIzXO5jJ','8c302c1666d5edb63bf0cf7c31dfa9e7a7308ef4cf1265095b2e4ad6dd8c8571','[\"*\"]','2026-09-23 04:39:48',NULL,'2026-09-23 04:28:23','2026-09-23 04:39:48'),(71,'App\\Models\\User',66,'auth_Pzbx7qG8','8b6bd4c71b99f7e567e3046281a5649c7abcf957272c0619bb148f9516661530','[\"*\"]','2026-09-23 05:10:04',NULL,'2026-09-23 04:39:59','2026-09-23 05:10:04'),(72,'App\\Models\\User',67,'auth_KGfbJVpS','e07f061bd6038d3a30ab40341699fa7597efdd56df9c04f7183efd9028444e7b','[\"*\"]','2026-09-23 05:10:27',NULL,'2026-09-23 05:10:09','2026-09-23 05:10:27'),(73,'App\\Models\\User',66,'auth_8Ppgv8mG','a6c79cb608a2ff6a38a6ca059ef14a05b516028fa637212a1abfa52b766859d2','[\"*\"]','2026-09-23 05:40:16',NULL,'2026-09-23 05:10:33','2026-09-23 05:40:16'),(74,'App\\Models\\User',67,'auth_DyceFJOg','40df098a567a1386425c73d4fe07fd5654e4a5d68e8c587c2ef7b4d37beec66b','[\"*\"]','2026-09-23 06:55:55',NULL,'2026-09-23 05:40:21','2026-09-23 06:55:55'),(75,'App\\Models\\User',66,'auth_YT3DPSUJ','ecaf1c913dce2f80bf0df2e92d6f636bdebb65c56e7050bb9e89708c229f4e1a','[\"*\"]','2026-09-23 06:56:08',NULL,'2026-09-23 06:56:03','2026-09-23 06:56:08'),(76,'App\\Models\\User',67,'auth_utrAaMlC','8821f5d2733ab4fec5a755fa75bec0bac1d2b617817e67b5aa8de37584d53c1b','[\"*\"]','2026-09-23 06:57:38',NULL,'2026-09-23 06:56:14','2026-09-23 06:57:38'),(77,'App\\Models\\User',66,'auth_J5WV1Yxi','858b5e8a94b4d8e4a9356337492aee2c24a579e0a23a375185500491c6c5c575','[\"*\"]','2026-09-24 00:59:23',NULL,'2026-09-23 06:57:44','2026-09-24 00:59:23'),(79,'App\\Models\\User',65,'auth_VRnwXrCj','9c85504bad43edffc7fdb14868ee82df82491b08c56800a55b7490197d74b75f','[\"*\"]','2026-09-24 01:03:56',NULL,'2026-09-24 00:59:31','2026-09-24 01:03:56'),(80,'App\\Models\\User',66,'auth_LkwEYQbF','9313bf205af8535a515bbe795ca35866c1621d10bc471feac0d993e4fffcc4f4','[\"*\"]','2026-09-24 23:02:26',NULL,'2026-09-24 01:04:01','2026-09-24 23:02:26'),(82,'App\\Models\\User',63,'auth_9Jb8WBNZ','40646c28feb6c3b30e991caa54977d5dcdfa7747add2171310642c6d2831a309','[\"*\"]','2026-09-25 03:43:03',NULL,'2026-09-24 23:02:35','2026-09-25 03:43:03'),(83,'App\\Models\\User',15,'auth_FwEU2VfJ','4bbc6f4887c6d9d658dfd4eba2414f0b13ae7913290a0530cc58de0c38679a69','[\"*\"]',NULL,NULL,'2026-09-25 01:03:42','2026-09-25 01:03:42'),(84,'App\\Models\\User',15,'auth_C2hnpRTw','c2c96b0e4d34b131c6f149503cf0ddc1c96c32bf2170151bf4dcaee3654c77ba','[\"*\"]','2026-09-25 01:03:48',NULL,'2026-09-25 01:03:48','2026-09-25 01:03:48'),(85,'App\\Models\\User',15,'auth_da7ZISem','c3f61f8a86b727c378307356625eaec0e81da5507e7df7cc94d800b38ca58704','[\"*\"]','2026-09-25 01:03:59',NULL,'2026-09-25 01:03:59','2026-09-25 01:03:59'),(86,'App\\Models\\User',15,'auth_mBDdmPQG','1ebdc7206c9d8ae8de3ea0cc0553852d6d0a64e45b4121a72c1f289a9fdcb6f2','[\"*\"]','2026-09-25 01:04:12',NULL,'2026-09-25 01:04:12','2026-09-25 01:04:12'),(87,'App\\Models\\User',15,'auth_shaqGFEV','66558fa44332e0cb018b10fec536e32f467017797b3d099184015602ca850208','[\"*\"]','2026-09-25 01:04:26',NULL,'2026-09-25 01:04:26','2026-09-25 01:04:26'),(88,'App\\Models\\User',15,'auth_aZWVONVH','8ccee34c622b3c376c6fafc2435f531c314f1f32ad0ba64632e6090c63add248','[\"*\"]','2026-09-25 01:04:35',NULL,'2026-09-25 01:04:35','2026-09-25 01:04:35'),(89,'App\\Models\\User',15,'auth_ZTZfgdNg','2bac63c87f535f47b5cfe0f1597b0db6201775d2bba10d3d3be3d0177aef6df2','[\"*\"]','2026-09-25 01:04:43',NULL,'2026-09-25 01:04:43','2026-09-25 01:04:43'),(91,'App\\Models\\User',14,'auth_vbew3on0','b556cbca525d597ab0dd21e192030039f7e6bb041b040656111c9381b89ff9e6','[\"*\"]','2026-09-25 01:39:15',NULL,'2026-09-25 01:39:15','2026-09-25 01:39:15'),(92,'App\\Models\\User',14,'auth_7MhH9uIK','a52ed30b5818768d0b55ae9469224094ea62cf3aba60d24182e36cfded9002bf','[\"*\"]','2026-09-25 01:39:21',NULL,'2026-09-25 01:39:21','2026-09-25 01:39:21'),(93,'App\\Models\\User',14,'auth_D62VTzlI','7068286b9ed89587d3c937c27903976f5747d398dff78a32f4dd26dcaa555c50','[\"*\"]','2026-09-25 01:39:28',NULL,'2026-09-25 01:39:28','2026-09-25 01:39:28'),(94,'App\\Models\\User',14,'auth_9XTrKn65','fad5638d6d623fc113502c0050ba5ee66598e92db643923d595cfa1cdc6e4972','[\"*\"]','2026-09-25 01:39:34',NULL,'2026-09-25 01:39:33','2026-09-25 01:39:34'),(95,'App\\Models\\User',14,'auth_EMZZNUaY','eae9380aad394fe1a428bab74ea789de36d5ae11f3f575384e1a9d0226fbd4ab','[\"*\"]','2026-09-25 02:54:46',NULL,'2026-09-25 02:54:46','2026-09-25 02:54:46'),(96,'App\\Models\\User',14,'auth_p7LYNTLf','f00ccdd2a55d939a23fde365423d1f17041b6144c1646479139d29c218a9cd85','[\"*\"]','2026-09-25 02:54:51',NULL,'2026-09-25 02:54:51','2026-09-25 02:54:51'),(97,'App\\Models\\User',14,'auth_c8JIeFTi','62e9cad6dee892a391f69c52bb8535460d7d1abb125ade76a4c89c9812d2098c','[\"*\"]','2026-09-25 02:55:01',NULL,'2026-09-25 02:55:01','2026-09-25 02:55:01'),(98,'App\\Models\\User',14,'auth_AzcYpk4K','8bde3c9a586efdb7dd9c2b6632eb41ae4e39f2e8bbadcc73342bbbcb9f88c3ba','[\"*\"]','2026-09-25 02:55:08',NULL,'2026-09-25 02:55:07','2026-09-25 02:55:08'),(99,'App\\Models\\User',14,'auth_3Nv7obaX','9908dd0e72fefb2c3612d0c7e08bbe8b63406ecd958240e141e8f488996d20ef','[\"*\"]','2026-09-25 02:55:13',NULL,'2026-09-25 02:55:13','2026-09-25 02:55:13'),(100,'App\\Models\\User',14,'auth_wRSOeHkp','ba01281a6062e86a59b2f670d57b2492b2c1b85e5fffcc68bcc4281a6ad34207','[\"*\"]','2026-09-25 03:09:53',NULL,'2026-09-25 03:09:53','2026-09-25 03:09:53'),(101,'App\\Models\\User',14,'auth_ACTcJtid','c7f342b9adeacec10f36c81d488d363a02aae05add6949a7b1d1a4ffb581fd4d','[\"*\"]','2026-09-25 03:10:00',NULL,'2026-09-25 03:09:59','2026-09-25 03:10:00'),(102,'App\\Models\\User',14,'auth_Uha2B9lu','3888c7d2ede481d7efebbe9ab22cc43e6fb4d55ff574013ff775154bee202a52','[\"*\"]','2026-09-25 03:10:07',NULL,'2026-09-25 03:10:07','2026-09-25 03:10:07'),(104,'App\\Models\\User',14,'auth_rbyP51xv','fc30ed9f9004508b9806c602ece45450d059c7221162b13a6659f086d8916449','[\"*\"]',NULL,NULL,'2026-09-25 03:25:19','2026-09-25 03:25:19'),(105,'App\\Models\\User',14,'auth_i3uutFFf','68b72724edd9a8f0c62108eb1c1133071198d3095843568756f1dec2a465c2ef','[\"*\"]',NULL,NULL,'2026-09-25 03:25:23','2026-09-25 03:25:23'),(106,'App\\Models\\User',14,'auth_xLG3w9Tk','d0e528fbb00ddd814f5c0d46d232a75d154f6388b3ecd102f94194773f9f4ecd','[\"*\"]','2026-09-25 03:26:02',NULL,'2026-09-25 03:26:02','2026-09-25 03:26:02'),(107,'App\\Models\\User',14,'auth_KM4aKxJl','70e67426adac1ec84029b2b867512d6dc4472e59a649813f2fbca1abc7dd187c','[\"*\"]','2026-09-25 03:26:07',NULL,'2026-09-25 03:26:07','2026-09-25 03:26:07'),(108,'App\\Models\\User',14,'auth_O9SGkq8y','68485fc1410e52f88451b24fea1ec3f5031d21e29b42a89bc4a5e44fe621b735','[\"*\"]','2026-09-25 03:26:16',NULL,'2026-09-25 03:26:16','2026-09-25 03:26:16'),(109,'App\\Models\\User',14,'auth_PTaQ0NMv','681f32082b6df8f345cdc74da5ca53209a150dde106d93eb476f34fb24101767','[\"*\"]','2026-09-25 03:26:42',NULL,'2026-09-25 03:26:41','2026-09-25 03:26:42'),(110,'App\\Models\\User',14,'auth_5VEcLiSQ','a0986cd7b8252ee69bf3e95fe68a2a576f6ff50f3fca41bad87a6a904cbc6f13','[\"*\"]','2026-09-25 03:26:53',NULL,'2026-09-25 03:26:53','2026-09-25 03:26:53'),(111,'App\\Models\\User',14,'auth_I8h1Pj5q','991f7f8501b13ff9ec1fa969478f19e553e6a97bdc905a6351c000ef217251d5','[\"*\"]','2026-09-25 03:27:00',NULL,'2026-09-25 03:26:59','2026-09-25 03:27:00'),(115,'App\\Models\\User',65,'auth_0mPYbwDw','8971b78b663800f47ba813da871006eb579808d0e8340b8e00819fc4d018ea13','[\"*\"]','2026-09-25 03:47:23',NULL,'2026-09-25 03:43:13','2026-09-25 03:47:23'),(116,'App\\Models\\User',66,'auth_Nx64q3V2','41a9fdf4e8f5249fbdb62d4b950907496795a3bf770017e3333c1d85a3d45a67','[\"*\"]','2026-09-25 03:47:58',NULL,'2026-09-25 03:47:28','2026-09-25 03:47:58'),(117,'App\\Models\\User',67,'auth_ydvSg3st','c4cca05b1e0f2477993b69ff488bb5d9657cbf3185ea2ba0c5eb8727b6db22af','[\"*\"]','2026-09-25 03:48:15',NULL,'2026-09-25 03:48:03','2026-09-25 03:48:15'),(118,'App\\Models\\User',66,'auth_5U3O9ccH','8de44b5faff618fb1c0b9b6b44618e52e79e724ebf9dfc9a2f3a249d3e9ef5e0','[\"*\"]','2026-09-25 03:49:36',NULL,'2026-09-25 03:48:19','2026-09-25 03:49:36'),(119,'App\\Models\\User',63,'auth_retGyBsB','337a7e8f1b2d9f1f14c7c656ebf987d0bf94b9ce27790cac884a0efeff0b56be','[\"*\"]','2026-09-26 01:03:59',NULL,'2026-09-25 03:49:44','2026-09-26 01:03:59'),(121,'App\\Models\\User',14,'auth_uCKv29h8','f86f69a092bd86b5e4f68f8d583ad75f38b1eb673d10c96b5580bc8b8c3d7643','[\"*\"]','2026-09-25 04:00:09',NULL,'2026-09-25 04:00:08','2026-09-25 04:00:09'),(122,'App\\Models\\User',14,'auth_4OG7NkLE','2e79212b46043afe173686c6eb9789689c1b927e960b6410af6d1975a1b68255','[\"*\"]','2026-09-25 04:15:33',NULL,'2026-09-25 04:15:33','2026-09-25 04:15:33'),(130,'App\\Models\\User',14,'auth_SwZ53yx4','58b062de41721562b2a2ef9f50d9dfbe35b223324b087061a694629c076adc5c','[\"*\"]',NULL,NULL,'2026-09-25 06:19:20','2026-09-25 06:19:20'),(144,'App\\Models\\User',65,'auth_ocqsojNb','3a45bb3c610a3d17e95eac8cb93addce301c07cbbaf4391394979b6a24c323d7','[\"*\"]','2026-09-26 01:23:19',NULL,'2026-09-26 01:04:08','2026-09-26 01:23:19'),(145,'App\\Models\\User',66,'auth_xOrKynnJ','359f8a9e6da8742a710906ad9a38646e134081d4156faa214fb07632275a9d26','[\"*\"]','2026-09-26 01:23:36',NULL,'2026-09-26 01:23:24','2026-09-26 01:23:36'),(146,'App\\Models\\User',67,'auth_2QtUOqJh','ae763f5b805bc8122c4052c4b202f8837e47cb9774e08abf2e53023c9c70142d','[\"*\"]','2026-09-26 01:23:46',NULL,'2026-09-26 01:23:46','2026-09-26 01:23:46'),(147,'App\\Models\\User',66,'auth_Wee55zqz','a26c72a0c1b03ae9dfb4d3836dada91b7a6af1952766ddcb93f979fb326b6889','[\"*\"]','2026-09-27 22:25:32',NULL,'2026-09-26 01:23:55','2026-09-27 22:25:32'),(150,'App\\Models\\User',64,'auth_u6QkoYqP','2c280b41826ea382896da48c70c3de77c366467c1ef15b99690554ec9d36cde1','[\"*\"]','2026-09-28 01:07:51',NULL,'2026-09-26 01:53:00','2026-09-28 01:07:51'),(152,'App\\Models\\User',63,'auth_MAYrdWCG','9db32d5c03c7bf0846e5da73dc7219d27cee4e40d74f2973913a9c079bce36da','[\"*\"]','2026-09-27 23:56:10',NULL,'2026-09-27 22:25:51','2026-09-27 23:56:10'),(154,'App\\Models\\User',65,'auth_gDvhvYcm','692cea6d684b5b8d4cfaf6d6deebe8f9ab0ea9cdbe60bad7fc2fc7a5bd5d9e18','[\"*\"]','2026-09-28 00:27:14',NULL,'2026-09-27 23:56:19','2026-09-28 00:27:14'),(155,'App\\Models\\User',65,'auth_hmK2GkER','3b00e2cce078011c15d517ba3d8a9a16f4002010fc23489ae096f0b70c93cb8a','[\"*\"]','2026-09-28 00:27:50',NULL,'2026-09-28 00:27:22','2026-09-28 00:27:50'),(156,'App\\Models\\User',63,'auth_UGeaB63N','f2f7d74c6055fd02b23c65332d42bd465c27f71809ac55d2e2cce4daa27d1933','[\"*\"]','2026-09-28 00:27:59',NULL,'2026-09-28 00:27:54','2026-09-28 00:27:59'),(157,'App\\Models\\User',65,'auth_HuGBNfYF','615da3c73319b709b4ba5392882ffd2a30241bfcba0ab19970f29d6afa1e78d2','[\"*\"]','2026-09-28 00:29:08',NULL,'2026-09-28 00:28:09','2026-09-28 00:29:08'),(158,'App\\Models\\User',65,'auth_ip3nFR2M','8ed9e05147b4192256035770e5b5be5161b5c9707039b98af31a4e9a04d6b0a6','[\"*\"]','2026-09-28 00:40:06',NULL,'2026-09-28 00:29:14','2026-09-28 00:40:06'),(159,'App\\Models\\User',63,'auth_UvRdtkAD','01eb9ff08b0ffe2167eff636656bfbb7eaff17b697825c903d0a07ae53b80dbd','[\"*\"]','2026-09-28 00:45:44',NULL,'2026-09-28 00:40:11','2026-09-28 00:45:44'),(161,'App\\Models\\User',65,'auth_dZmYE1kG','20b4e059dad6467a2ac8075db85fd5ac295babf9d1a29002328b85b0b5ac645e','[\"*\"]','2026-09-28 00:52:50',NULL,'2026-09-28 00:46:23','2026-09-28 00:52:50'),(162,'App\\Models\\User',16,'auth_5ibQ0DUs','6cbf5b9df4d04bd8006cf1a2d12fa0bb487ea87109d9fe7a49b437297b7a293c','[\"*\"]','2026-09-28 01:07:55',NULL,'2026-09-28 00:46:30','2026-09-28 01:07:55'),(163,'App\\Models\\User',65,'auth_njcQaomq','a02a2d8712c0a395a7a3ebaf5e5b52d5382b96aff9c10db202eb461a006aee3f','[\"*\"]','2026-09-28 01:02:46',NULL,'2026-09-28 00:53:03','2026-09-28 01:02:46'),(164,'App\\Models\\User',65,'auth_sjV67Y7X','1423e49ee508835cdc6faf6955c00b2e20813efbd75ede23b8eb8614beb55ccb','[\"*\"]','2026-09-28 01:06:25',NULL,'2026-09-28 01:02:55','2026-09-28 01:06:25');
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_addons`
--

DROP TABLE IF EXISTS `product_addons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_addons` (
  `product_id` bigint unsigned NOT NULL,
  `addon_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`product_id`,`addon_id`),
  KEY `product_addons_addon_id_foreign` (`addon_id`),
  CONSTRAINT `product_addons_addon_id_foreign` FOREIGN KEY (`addon_id`) REFERENCES `addons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_addons_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_addons`
--

LOCK TABLES `product_addons` WRITE;
/*!40000 ALTER TABLE `product_addons` DISABLE KEYS */;
INSERT INTO `product_addons` VALUES (4,1),(5,1),(6,1),(7,1),(8,1),(9,1),(10,1),(11,1),(12,1),(13,1),(14,1),(15,1);
/*!40000 ALTER TABLE `product_addons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_variants`
--

DROP TABLE IF EXISTS `product_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_variants` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `barcode` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `compare_at_price` decimal(10,2) DEFAULT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `color` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `weight` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `attributes` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_variants_sku_unique` (`sku`),
  KEY `product_variants_product_id_foreign` (`product_id`),
  CONSTRAINT `product_variants_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_variants`
--

LOCK TABLES `product_variants` WRITE;
/*!40000 ALTER TABLE `product_variants` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_variants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_variation_options`
--

DROP TABLE IF EXISTS `product_variation_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_variation_options` (
  `product_id` bigint unsigned NOT NULL,
  `variation_option_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`product_id`,`variation_option_id`),
  KEY `product_variation_options_variation_option_id_foreign` (`variation_option_id`),
  CONSTRAINT `product_variation_options_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_variation_options_variation_option_id_foreign` FOREIGN KEY (`variation_option_id`) REFERENCES `variation_options` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_variation_options`
--

LOCK TABLES `product_variation_options` WRITE;
/*!40000 ALTER TABLE `product_variation_options` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_variation_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` bigint unsigned NOT NULL,
  `store_id` bigint unsigned DEFAULT NULL,
  `restaurant_id` bigint unsigned DEFAULT NULL,
  `category_id` bigint unsigned DEFAULT NULL,
  `vendor_category_id` bigint unsigned DEFAULT NULL,
  `brand_id` bigint unsigned DEFAULT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'food',
  `product_type` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'simple',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `sku` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `barcode` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `compare_at_price` decimal(10,2) DEFAULT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `unit_type` enum('item','kg','g','l','ml','pack','dozen','piece') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'item',
  `unit_value` decimal(10,3) DEFAULT NULL,
  `unit_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `images` json DEFAULT NULL,
  `is_veg` tinyint(1) DEFAULT NULL,
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_available` tinyint(1) NOT NULL DEFAULT '1',
  `min_order_qty` int unsigned NOT NULL DEFAULT '1',
  `max_order_qty` int unsigned DEFAULT NULL,
  `nutrition_info` json DEFAULT NULL,
  `ingredients` json DEFAULT NULL,
  `tax_category` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tax_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `preparation_time_min` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `products_store_id_foreign` (`store_id`),
  KEY `products_restaurant_id_foreign` (`restaurant_id`),
  KEY `products_category_id_foreign` (`category_id`),
  KEY `products_brand_id_foreign` (`brand_id`),
  KEY `products_type_is_active_index` (`type`,`is_active`),
  KEY `products_vendor_id_category_id_index` (`vendor_id`,`category_id`),
  KEY `products_name_index` (`name`),
  KEY `products_sku_index` (`sku`),
  KEY `products_barcode_index` (`barcode`),
  KEY `products_vendor_category_id_foreign` (`vendor_category_id`),
  CONSTRAINT `products_brand_id_foreign` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`id`) ON DELETE SET NULL,
  CONSTRAINT `products_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `products_restaurant_id_foreign` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `products_store_id_foreign` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  CONSTRAINT `products_vendor_category_id_foreign` FOREIGN KEY (`vendor_category_id`) REFERENCES `vendor_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `products_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=127 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (4,6,NULL,1,1,1,NULL,'food','simple','Paneer Tikka','paneer-tikka','Cottage cheese marinated in spices, grilled in clay oven',NULL,NULL,249.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/prod-paneer-tikka/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(5,6,NULL,1,1,1,NULL,'food','simple','Chicken Tikka','chicken-tikka','Chicken marinated in yogurt and spices, grilled',NULL,NULL,299.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/prod-chicken-tikka/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(6,6,NULL,1,9,7,NULL,'food','simple','Veg Biryani','veg-biryani','Fragrant basmati rice with vegetables and spices',NULL,NULL,279.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/prod-veg-biryani/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(7,6,NULL,1,9,7,NULL,'food','simple','Chicken Biryani','chicken-biryani','Chicken pieces with fragrant basmati rice',NULL,NULL,329.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/prod-chicken-biryani/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(8,6,NULL,1,5,4,NULL,'food','variable','Paneer Butter Masala','paneer-butter-masala','Cottage cheese in rich creamy tomato gravy',NULL,NULL,299.00,NULL,NULL,'item',NULL,NULL,'http://localhost:8000/storage/products/8EHoesaY5A9QqBYFj4snD20HLWhpR37d1nEoRNgA.jpg',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-25 01:08:33',NULL),(9,6,NULL,1,5,4,NULL,'food','simple','Dal Makhani','dal-makhani','Black lentils slow-cooked with butter and cream',NULL,NULL,249.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/prod-dal-makhani/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(10,6,NULL,1,13,10,NULL,'food','simple','Butter Naan','butter-naan','Tandoor-baked flatbread with butter',NULL,NULL,49.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/prod-butter-naan/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(11,6,NULL,1,13,10,NULL,'food','simple','Garlic Naan','garlic-naan','Flatbread topped with garlic and coriander',NULL,NULL,59.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/prod-garlic-naan/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(12,6,NULL,1,16,11,NULL,'food','simple','Gulab Jamun','gulab-jamun','Deep-fried milk dumplings in sugar syrup',NULL,NULL,99.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/prod-gulab-jamun/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(13,6,NULL,1,16,11,NULL,'food','simple','Chocolate Brownie','chocolate-brownie','Warm chocolate brownie with fudge',NULL,NULL,149.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/prod-chocolate-brownie/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(14,6,NULL,1,20,12,NULL,'food','variable','Masala Chai','masala-chai','Indian spiced tea',NULL,NULL,69.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/prod-masala-chai/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-25 01:19:28',NULL),(15,6,NULL,1,20,12,NULL,'food','simple','Fresh Lime Soda','fresh-lime-soda','Fizzy lime and mint refreshment',NULL,NULL,79.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/prod-fresh-lime-soda/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(16,7,1,NULL,32,NULL,1,'grocery','simple','Amul Taaza Milk 500ml','amul-taaza-milk-500ml','Fresh toned milk',NULL,NULL,27.00,NULL,NULL,'item',100.000,'0.5','https://picsum.photos/seed/prod-amul-taaza-milk-500ml/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15',NULL),(17,7,1,NULL,32,NULL,1,'grocery','simple','Amul Butter 100g','amul-butter-100g','Creamy butter',NULL,NULL,58.00,NULL,NULL,'piece',80.000,'0.1','https://picsum.photos/seed/prod-amul-butter-100g/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15',NULL),(18,7,1,NULL,32,NULL,NULL,'grocery','simple','Farm Eggs (6 pack)','farm-eggs-6','Fresh farm eggs',NULL,NULL,78.00,NULL,NULL,'pack',150.000,'6','https://picsum.photos/seed/prod-farm-eggs-6/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15',NULL),(19,7,1,NULL,28,NULL,NULL,'grocery','simple','Banana (1 kg)','banana-1kg','Fresh bananas',NULL,NULL,60.00,NULL,NULL,'kg',300.000,'1','https://picsum.photos/seed/prod-banana-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15',NULL),(20,7,1,NULL,28,NULL,NULL,'grocery','simple','Tomato (1 kg)','tomato-1kg','Fresh tomatoes',NULL,NULL,40.00,NULL,NULL,'kg',200.000,'1','https://picsum.photos/seed/prod-tomato-1kg/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15',NULL),(21,7,1,NULL,28,NULL,NULL,'grocery','simple','Onion (1 kg)','onion-1kg','Fresh onions',NULL,NULL,35.00,NULL,NULL,'kg',250.000,'1','https://picsum.photos/seed/prod-onion-1kg/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15',NULL),(22,7,1,NULL,37,21,5,'grocery','simple','White Bread','white-bread','Soft white bread',NULL,NULL,45.00,NULL,NULL,'pack',60.000,'0.4','https://picsum.photos/seed/prod-white-bread/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(23,7,1,NULL,41,NULL,6,'grocery','simple','Fortune Sunflower Oil 1L','fortune-sunflower-oil-1l','Pure sunflower oil',NULL,NULL,155.00,NULL,NULL,'l',80.000,'1','https://picsum.photos/seed/prod-fortune-sunflower-oil-1l/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15',NULL),(24,7,1,NULL,41,NULL,7,'grocery','variable','Aashirvaad Atta','aashirvaad-atta-5kg','Whole wheat flour',NULL,NULL,265.00,NULL,NULL,'kg',120.000,'5','https://picsum.photos/seed/prod-aashirvaad-atta-5kg/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,0.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-25 03:14:01',NULL),(25,7,1,NULL,41,NULL,3,'grocery','simple','Basmati Rice 5kg','basmati-rice-5kg','Premium basmati rice',NULL,NULL,450.00,NULL,NULL,'kg',50.000,'5','https://picsum.photos/seed/prod-basmati-rice-5kg/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15',NULL),(26,7,1,NULL,56,NULL,8,'grocery','simple','Surf Excel 1kg','surf-excel-1kg','Laundry detergent powder',NULL,NULL,175.00,NULL,NULL,'kg',40.000,'1','https://picsum.photos/seed/prod-surf-excel-1kg/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15',NULL),(27,7,1,NULL,60,28,9,'grocery','simple','Colgate 150g','colgate-150g','Toothpaste',NULL,NULL,45.00,NULL,NULL,'piece',30.000,'0.15','https://picsum.photos/seed/prod-colgate-150g/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(28,7,1,NULL,47,25,NULL,'grocery','simple','Lays Classic Chips','lays-classic-chips','Potato chips',NULL,NULL,20.00,NULL,NULL,'pack',100.000,'0.05','https://picsum.photos/seed/prod-lays-classic-chips/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(29,7,1,NULL,47,25,2,'grocery','simple','Maggi Noodles 2-min','maggi-noodles','Instant noodles',NULL,NULL,14.00,NULL,NULL,'pack',100.000,'0.07','https://picsum.photos/seed/prod-maggi-noodles/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:25',NULL),(30,7,1,NULL,52,NULL,NULL,'grocery','simple','Coca-Cola 750ml','coca-cola-750ml','Soft drink',NULL,NULL,40.00,NULL,NULL,'l',80.000,'0.75','https://picsum.photos/seed/prod-coca-cola-750ml/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15',NULL),(31,8,NULL,2,1,NULL,NULL,'food','simple','Mirchi Vada','mirchi-vada','Fried green chilli fritters stuffed with spiced potatoes',NULL,NULL,59.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-mirchi-vada/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(32,8,NULL,2,1,NULL,NULL,'food','simple','Pyaaz Kachori','pyaaz-kachori','Flaky pastry stuffed with onion masala',NULL,NULL,49.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-pyaaz-kachori/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(33,8,NULL,2,5,NULL,NULL,'food','simple','Dal Baati Churma','dal-baati-churma','Baked wheat baatis with dal and sweet churma',NULL,NULL,329.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-dal-baati-churma/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(34,8,NULL,2,5,NULL,NULL,'food','simple','Gatte ki Sabzi','gatte-ki-sabzi','Gram-flour dumplings in tangy yogurt gravy',NULL,NULL,269.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-gatte-ki-sabzi/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(35,8,NULL,2,5,NULL,NULL,'food','simple','Laal Maas','laal-maas','Fiery Rajasthani mutton curry in red chilli gravy',NULL,NULL,399.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-laal-maas/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(36,8,NULL,2,5,NULL,NULL,'food','simple','Ker Sangri','ker-sangri','Classic desert beans and berries sabzi',NULL,NULL,249.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-ker-sangri/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(37,8,NULL,2,5,NULL,NULL,'food','simple','Rajasthani Thali','rajasthani-thali','Full thali: dal, baati, gatte, ker sangri, roti, rice, dessert',NULL,NULL,449.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-rajasthani-thali/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(38,8,NULL,2,13,NULL,NULL,'food','simple','Bajra Roti (2 pcs)','bajra-roti','Pearl millet flatbread with ghee',NULL,NULL,59.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-bajra-roti/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(39,8,NULL,2,16,NULL,NULL,'food','simple','Ghewar (2 pcs)','ghewar','Jaipur-style honey-soaked disc dessert',NULL,NULL,149.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-ghewar/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(40,8,NULL,2,16,NULL,NULL,'food','simple','Kesar Kulfi','kesar-kulfi','Saffron kulfi with pistachio',NULL,NULL,99.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-kesar-kulfi/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(41,8,NULL,2,20,NULL,NULL,'food','simple','Masala Chaas','masala-chaas','Spiced buttermilk with roasted cumin',NULL,NULL,49.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-masala-chaas/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(42,8,NULL,2,1,NULL,NULL,'food','simple','Imli Papdi Chaat','imli-papdi-chaat','Crisp papdis with tamarind chutney and yogurt',NULL,NULL,99.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/raj-imli-papdi-chaat/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(43,9,NULL,3,1,NULL,NULL,'food','simple','Paneer Tikka','paneer-tikka','Cottage cheese marinated in spices and grilled',NULL,NULL,249.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/handi-restaurant-paneer-tikka/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(44,9,NULL,3,5,NULL,NULL,'food','simple','Dal Baati Churma','dal-baati-churma','Baked baatis with dal and sweet churma',NULL,NULL,299.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/handi-restaurant-dal-baati-churma/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(45,9,NULL,3,5,NULL,NULL,'food','simple','Laal Maas','laal-maas','Fiery Rajasthani mutton curry',NULL,NULL,399.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/handi-restaurant-laal-maas/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(46,9,NULL,3,13,NULL,NULL,'food','simple','Butter Naan','butter-naan','Tandoor-baked flatbread with butter',NULL,NULL,49.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/handi-restaurant-butter-naan/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(47,9,NULL,3,16,NULL,NULL,'food','simple','Gulab Jamun','gulab-jamun','Milk dumplings in sugar syrup',NULL,NULL,99.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/handi-restaurant-gulab-jamun/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(48,9,NULL,3,20,NULL,NULL,'food','simple','Masala Chai','masala-chai','Indian spiced tea',NULL,NULL,69.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/handi-restaurant-masala-chai/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(49,10,NULL,4,1,NULL,NULL,'food','simple','Paneer Tikka','paneer-tikka','Cottage cheese marinated in spices and grilled',NULL,NULL,249.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/laxmi-mishthan-bhandar-paneer-tikka/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(50,10,NULL,4,5,NULL,NULL,'food','simple','Dal Baati Churma','dal-baati-churma','Baked baatis with dal and sweet churma',NULL,NULL,299.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/laxmi-mishthan-bhandar-dal-baati-churma/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(51,10,NULL,4,5,NULL,NULL,'food','simple','Laal Maas','laal-maas','Fiery Rajasthani mutton curry',NULL,NULL,399.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/laxmi-mishthan-bhandar-laal-maas/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(52,10,NULL,4,13,NULL,NULL,'food','simple','Butter Naan','butter-naan','Tandoor-baked flatbread with butter',NULL,NULL,49.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/laxmi-mishthan-bhandar-butter-naan/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(53,10,NULL,4,16,NULL,NULL,'food','simple','Gulab Jamun','gulab-jamun','Milk dumplings in sugar syrup',NULL,NULL,99.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/laxmi-mishthan-bhandar-gulab-jamun/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(54,10,NULL,4,20,NULL,NULL,'food','simple','Masala Chai','masala-chai','Indian spiced tea',NULL,NULL,69.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/laxmi-mishthan-bhandar-masala-chai/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(55,11,2,NULL,32,NULL,NULL,'grocery','simple','Amul Taaza Milk 500ml','amul-taaza-milk-500ml','Amul Taaza Milk 500ml — everyday essential',NULL,NULL,27.00,NULL,NULL,'item',0.500,'500 ml','https://picsum.photos/seed/jaipur-grocers-amul-taaza-milk-500ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(56,11,2,NULL,32,NULL,NULL,'grocery','simple','Farm Eggs (6 pack)','farm-eggs-6','Farm Eggs (6 pack) — everyday essential',NULL,NULL,78.00,NULL,NULL,'pack',6.000,'6 pieces','https://picsum.photos/seed/jaipur-grocers-farm-eggs-6/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(57,11,2,NULL,28,NULL,NULL,'grocery','simple','Banana (1 kg)','banana-1kg','Banana (1 kg) — everyday essential',NULL,NULL,60.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/jaipur-grocers-banana-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(58,11,2,NULL,28,NULL,NULL,'grocery','simple','Tomato (1 kg)','tomato-1kg','Tomato (1 kg) — everyday essential',NULL,NULL,40.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/jaipur-grocers-tomato-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(59,11,2,NULL,37,NULL,NULL,'grocery','simple','White Bread','white-bread','White Bread — everyday essential',NULL,NULL,45.00,NULL,NULL,'pack',0.400,'400 g','https://picsum.photos/seed/jaipur-grocers-white-bread/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(60,11,2,NULL,41,NULL,NULL,'grocery','simple','Aashirvaad Atta 5kg','aashirvaad-atta-5kg','Aashirvaad Atta 5kg — everyday essential',NULL,NULL,265.00,NULL,NULL,'kg',5.000,'5 kg','https://picsum.photos/seed/jaipur-grocers-aashirvaad-atta-5kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(61,11,2,NULL,47,NULL,NULL,'grocery','simple','Lays Classic Chips','lays-classic-chips','Lays Classic Chips — everyday essential',NULL,NULL,20.00,NULL,NULL,'pack',0.052,'52 g','https://picsum.photos/seed/jaipur-grocers-lays-classic-chips/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(62,11,2,NULL,52,NULL,NULL,'grocery','simple','Coca-Cola 750ml','coca-cola-750ml','Coca-Cola 750ml — everyday essential',NULL,NULL,40.00,NULL,NULL,'l',0.750,'750 ml','https://picsum.photos/seed/jaipur-grocers-coca-cola-750ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(63,12,3,NULL,32,NULL,NULL,'grocery','simple','Amul Taaza Milk 500ml','amul-taaza-milk-500ml','Amul Taaza Milk 500ml — everyday essential',NULL,NULL,27.00,NULL,NULL,'item',0.500,'500 ml','https://picsum.photos/seed/pink-city-supermart-amul-taaza-milk-500ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(64,12,3,NULL,32,NULL,NULL,'grocery','simple','Farm Eggs (6 pack)','farm-eggs-6','Farm Eggs (6 pack) — everyday essential',NULL,NULL,78.00,NULL,NULL,'pack',6.000,'6 pieces','https://picsum.photos/seed/pink-city-supermart-farm-eggs-6/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(65,12,3,NULL,28,NULL,NULL,'grocery','simple','Banana (1 kg)','banana-1kg','Banana (1 kg) — everyday essential',NULL,NULL,60.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/pink-city-supermart-banana-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(66,12,3,NULL,28,NULL,NULL,'grocery','simple','Tomato (1 kg)','tomato-1kg','Tomato (1 kg) — everyday essential',NULL,NULL,40.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/pink-city-supermart-tomato-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(67,12,3,NULL,37,NULL,NULL,'grocery','simple','White Bread','white-bread','White Bread — everyday essential',NULL,NULL,45.00,NULL,NULL,'pack',0.400,'400 g','https://picsum.photos/seed/pink-city-supermart-white-bread/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(68,12,3,NULL,41,NULL,NULL,'grocery','simple','Aashirvaad Atta 5kg','aashirvaad-atta-5kg','Aashirvaad Atta 5kg — everyday essential',NULL,NULL,265.00,NULL,NULL,'kg',5.000,'5 kg','https://picsum.photos/seed/pink-city-supermart-aashirvaad-atta-5kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(69,12,3,NULL,47,NULL,NULL,'grocery','simple','Lays Classic Chips','lays-classic-chips','Lays Classic Chips — everyday essential',NULL,NULL,20.00,NULL,NULL,'pack',0.052,'52 g','https://picsum.photos/seed/pink-city-supermart-lays-classic-chips/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(70,12,3,NULL,52,NULL,NULL,'grocery','simple','Coca-Cola 750ml','coca-cola-750ml','Coca-Cola 750ml — everyday essential',NULL,NULL,40.00,NULL,NULL,'l',0.750,'750 ml','https://picsum.photos/seed/pink-city-supermart-coca-cola-750ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(71,13,NULL,5,1,NULL,NULL,'food','simple','Paneer Tikka','paneer-tikka','Cottage cheese marinated in spices and grilled',NULL,NULL,249.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/vidhyadhar-dhaba-paneer-tikka/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(72,13,NULL,5,5,NULL,NULL,'food','simple','Dal Baati Churma','dal-baati-churma','Baked baatis with dal and sweet churma',NULL,NULL,299.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/vidhyadhar-dhaba-dal-baati-churma/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(73,13,NULL,5,5,NULL,NULL,'food','simple','Laal Maas','laal-maas','Fiery Rajasthani mutton curry',NULL,NULL,399.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/vidhyadhar-dhaba-laal-maas/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(74,13,NULL,5,13,NULL,NULL,'food','simple','Butter Naan','butter-naan','Tandoor-baked flatbread with butter',NULL,NULL,49.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/vidhyadhar-dhaba-butter-naan/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(75,13,NULL,5,16,NULL,NULL,'food','simple','Gulab Jamun','gulab-jamun','Milk dumplings in sugar syrup',NULL,NULL,99.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/vidhyadhar-dhaba-gulab-jamun/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(76,13,NULL,5,20,NULL,NULL,'food','simple','Masala Chai','masala-chai','Indian spiced tea',NULL,NULL,69.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/vidhyadhar-dhaba-masala-chai/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(77,14,NULL,6,1,NULL,NULL,'food','simple','Paneer Tikka','paneer-tikka','Cottage cheese marinated in spices and grilled',NULL,NULL,249.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jhotwara-kitchen-paneer-tikka/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(78,14,NULL,6,5,NULL,NULL,'food','simple','Dal Baati Churma','dal-baati-churma','Baked baatis with dal and sweet churma',NULL,NULL,299.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jhotwara-kitchen-dal-baati-churma/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(79,14,NULL,6,5,NULL,NULL,'food','simple','Laal Maas','laal-maas','Fiery Rajasthani mutton curry',NULL,NULL,399.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jhotwara-kitchen-laal-maas/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(80,14,NULL,6,13,NULL,NULL,'food','simple','Butter Naan','butter-naan','Tandoor-baked flatbread with butter',NULL,NULL,49.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jhotwara-kitchen-butter-naan/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(81,14,NULL,6,16,NULL,NULL,'food','simple','Gulab Jamun','gulab-jamun','Milk dumplings in sugar syrup',NULL,NULL,99.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jhotwara-kitchen-gulab-jamun/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(82,14,NULL,6,20,NULL,NULL,'food','simple','Masala Chai','masala-chai','Indian spiced tea',NULL,NULL,69.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jhotwara-kitchen-masala-chai/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(83,15,4,NULL,32,NULL,NULL,'grocery','simple','Amul Taaza Milk 500ml','amul-taaza-milk-500ml','Amul Taaza Milk 500ml — everyday essential',NULL,NULL,27.00,NULL,NULL,'item',0.500,'500 ml','https://picsum.photos/seed/north-mart-amul-taaza-milk-500ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(84,15,4,NULL,32,NULL,NULL,'grocery','simple','Farm Eggs (6 pack)','farm-eggs-6','Farm Eggs (6 pack) — everyday essential',NULL,NULL,78.00,NULL,NULL,'pack',6.000,'6 pieces','https://picsum.photos/seed/north-mart-farm-eggs-6/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(85,15,4,NULL,28,NULL,NULL,'grocery','simple','Banana (1 kg)','banana-1kg','Banana (1 kg) — everyday essential',NULL,NULL,60.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/north-mart-banana-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(86,15,4,NULL,28,NULL,NULL,'grocery','simple','Tomato (1 kg)','tomato-1kg','Tomato (1 kg) — everyday essential',NULL,NULL,40.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/north-mart-tomato-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(87,15,4,NULL,37,NULL,NULL,'grocery','simple','White Bread','white-bread','White Bread — everyday essential',NULL,NULL,45.00,NULL,NULL,'pack',0.400,'400 g','https://picsum.photos/seed/north-mart-white-bread/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(88,15,4,NULL,41,NULL,NULL,'grocery','simple','Aashirvaad Atta 5kg','aashirvaad-atta-5kg','Aashirvaad Atta 5kg — everyday essential',NULL,NULL,265.00,NULL,NULL,'kg',5.000,'5 kg','https://picsum.photos/seed/north-mart-aashirvaad-atta-5kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(89,15,4,NULL,47,NULL,NULL,'grocery','simple','Lays Classic Chips','lays-classic-chips','Lays Classic Chips — everyday essential',NULL,NULL,20.00,NULL,NULL,'pack',0.052,'52 g','https://picsum.photos/seed/north-mart-lays-classic-chips/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(90,15,4,NULL,52,NULL,NULL,'grocery','simple','Coca-Cola 750ml','coca-cola-750ml','Coca-Cola 750ml — everyday essential',NULL,NULL,40.00,NULL,NULL,'l',0.750,'750 ml','https://picsum.photos/seed/north-mart-coca-cola-750ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(91,16,5,NULL,32,NULL,NULL,'grocery','simple','Amul Taaza Milk 500ml','amul-taaza-milk-500ml','Amul Taaza Milk 500ml — everyday essential',NULL,NULL,27.00,NULL,NULL,'item',0.500,'500 ml','https://picsum.photos/seed/sodala-daily-needs-amul-taaza-milk-500ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(92,16,5,NULL,32,NULL,NULL,'grocery','simple','Farm Eggs (6 pack)','farm-eggs-6','Farm Eggs (6 pack) — everyday essential',NULL,NULL,78.00,NULL,NULL,'pack',6.000,'6 pieces','https://picsum.photos/seed/sodala-daily-needs-farm-eggs-6/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(93,16,5,NULL,28,NULL,NULL,'grocery','simple','Banana (1 kg)','banana-1kg','Banana (1 kg) — everyday essential',NULL,NULL,60.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/sodala-daily-needs-banana-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(94,16,5,NULL,28,NULL,NULL,'grocery','simple','Tomato (1 kg)','tomato-1kg','Tomato (1 kg) — everyday essential',NULL,NULL,40.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/sodala-daily-needs-tomato-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(95,16,5,NULL,37,NULL,NULL,'grocery','simple','White Bread','white-bread','White Bread — everyday essential',NULL,NULL,45.00,NULL,NULL,'pack',0.400,'400 g','https://picsum.photos/seed/sodala-daily-needs-white-bread/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(96,16,5,NULL,41,NULL,NULL,'grocery','simple','Aashirvaad Atta 5kg','aashirvaad-atta-5kg','Aashirvaad Atta 5kg — everyday essential',NULL,NULL,265.00,NULL,NULL,'kg',5.000,'5 kg','https://picsum.photos/seed/sodala-daily-needs-aashirvaad-atta-5kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(97,16,5,NULL,47,NULL,NULL,'grocery','simple','Lays Classic Chips','lays-classic-chips','Lays Classic Chips — everyday essential',NULL,NULL,20.00,NULL,NULL,'pack',0.052,'52 g','https://picsum.photos/seed/sodala-daily-needs-lays-classic-chips/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(98,16,5,NULL,52,NULL,NULL,'grocery','simple','Coca-Cola 750ml','coca-cola-750ml','Coca-Cola 750ml — everyday essential',NULL,NULL,40.00,NULL,NULL,'l',0.750,'750 ml','https://picsum.photos/seed/sodala-daily-needs-coca-cola-750ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(99,17,NULL,7,1,NULL,NULL,'food','simple','Paneer Tikka','paneer-tikka','Cottage cheese marinated in spices and grilled',NULL,NULL,249.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jagatpura-spice-court-paneer-tikka/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(100,17,NULL,7,5,NULL,NULL,'food','simple','Dal Baati Churma','dal-baati-churma','Baked baatis with dal and sweet churma',NULL,NULL,299.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jagatpura-spice-court-dal-baati-churma/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(101,17,NULL,7,5,NULL,NULL,'food','simple','Laal Maas','laal-maas','Fiery Rajasthani mutton curry',NULL,NULL,399.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jagatpura-spice-court-laal-maas/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(102,17,NULL,7,13,NULL,NULL,'food','simple','Butter Naan','butter-naan','Tandoor-baked flatbread with butter',NULL,NULL,49.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jagatpura-spice-court-butter-naan/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(103,17,NULL,7,16,NULL,NULL,'food','simple','Gulab Jamun','gulab-jamun','Milk dumplings in sugar syrup',NULL,NULL,99.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jagatpura-spice-court-gulab-jamun/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(104,17,NULL,7,20,NULL,NULL,'food','simple','Masala Chai','masala-chai','Indian spiced tea',NULL,NULL,69.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/jagatpura-spice-court-masala-chai/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(105,18,NULL,8,1,NULL,NULL,'food','simple','Paneer Tikka','paneer-tikka','Cottage cheese marinated in spices and grilled',NULL,NULL,249.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/sitapura-biryani-house-paneer-tikka/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(106,18,NULL,8,5,NULL,NULL,'food','simple','Dal Baati Churma','dal-baati-churma','Baked baatis with dal and sweet churma',NULL,NULL,299.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/sitapura-biryani-house-dal-baati-churma/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(107,18,NULL,8,5,NULL,NULL,'food','simple','Laal Maas','laal-maas','Fiery Rajasthani mutton curry',NULL,NULL,399.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/sitapura-biryani-house-laal-maas/600/400',NULL,0,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(108,18,NULL,8,13,NULL,NULL,'food','simple','Butter Naan','butter-naan','Tandoor-baked flatbread with butter',NULL,NULL,49.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/sitapura-biryani-house-butter-naan/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(109,18,NULL,8,16,NULL,NULL,'food','simple','Gulab Jamun','gulab-jamun','Milk dumplings in sugar syrup',NULL,NULL,99.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/sitapura-biryani-house-gulab-jamun/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(110,18,NULL,8,20,NULL,NULL,'food','simple','Masala Chai','masala-chai','Indian spiced tea',NULL,NULL,69.00,NULL,NULL,'item',NULL,NULL,'https://picsum.photos/seed/sitapura-biryani-house-masala-chai/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,'15',NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(111,19,6,NULL,32,NULL,NULL,'grocery','simple','Amul Taaza Milk 500ml','amul-taaza-milk-500ml','Amul Taaza Milk 500ml — everyday essential',NULL,NULL,27.00,NULL,NULL,'item',0.500,'500 ml','https://picsum.photos/seed/south-super-bazaar-amul-taaza-milk-500ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(112,19,6,NULL,32,NULL,NULL,'grocery','simple','Farm Eggs (6 pack)','farm-eggs-6','Farm Eggs (6 pack) — everyday essential',NULL,NULL,78.00,NULL,NULL,'pack',6.000,'6 pieces','https://picsum.photos/seed/south-super-bazaar-farm-eggs-6/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(113,19,6,NULL,28,NULL,NULL,'grocery','simple','Banana (1 kg)','banana-1kg','Banana (1 kg) — everyday essential',NULL,NULL,60.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/south-super-bazaar-banana-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(114,19,6,NULL,28,NULL,NULL,'grocery','simple','Tomato (1 kg)','tomato-1kg','Tomato (1 kg) — everyday essential',NULL,NULL,40.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/south-super-bazaar-tomato-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(115,19,6,NULL,37,NULL,NULL,'grocery','simple','White Bread','white-bread','White Bread — everyday essential',NULL,NULL,45.00,NULL,NULL,'pack',0.400,'400 g','https://picsum.photos/seed/south-super-bazaar-white-bread/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(116,19,6,NULL,41,NULL,NULL,'grocery','simple','Aashirvaad Atta 5kg','aashirvaad-atta-5kg','Aashirvaad Atta 5kg — everyday essential',NULL,NULL,265.00,NULL,NULL,'kg',5.000,'5 kg','https://picsum.photos/seed/south-super-bazaar-aashirvaad-atta-5kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(117,19,6,NULL,47,NULL,NULL,'grocery','simple','Lays Classic Chips','lays-classic-chips','Lays Classic Chips — everyday essential',NULL,NULL,20.00,NULL,NULL,'pack',0.052,'52 g','https://picsum.photos/seed/south-super-bazaar-lays-classic-chips/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(118,19,6,NULL,52,NULL,NULL,'grocery','simple','Coca-Cola 750ml','coca-cola-750ml','Coca-Cola 750ml — everyday essential',NULL,NULL,40.00,NULL,NULL,'l',0.750,'750 ml','https://picsum.photos/seed/south-super-bazaar-coca-cola-750ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(119,20,7,NULL,32,NULL,NULL,'grocery','simple','Amul Taaza Milk 500ml','amul-taaza-milk-500ml','Amul Taaza Milk 500ml — everyday essential',NULL,NULL,27.00,NULL,NULL,'item',0.500,'500 ml','https://picsum.photos/seed/malviya-fresh-mart-amul-taaza-milk-500ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(120,20,7,NULL,32,NULL,NULL,'grocery','simple','Farm Eggs (6 pack)','farm-eggs-6','Farm Eggs (6 pack) — everyday essential',NULL,NULL,78.00,NULL,NULL,'pack',6.000,'6 pieces','https://picsum.photos/seed/malviya-fresh-mart-farm-eggs-6/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(121,20,7,NULL,28,NULL,NULL,'grocery','simple','Banana (1 kg)','banana-1kg','Banana (1 kg) — everyday essential',NULL,NULL,60.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/malviya-fresh-mart-banana-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(122,20,7,NULL,28,NULL,NULL,'grocery','simple','Tomato (1 kg)','tomato-1kg','Tomato (1 kg) — everyday essential',NULL,NULL,40.00,NULL,NULL,'kg',1.000,'1 kg','https://picsum.photos/seed/malviya-fresh-mart-tomato-1kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(123,20,7,NULL,37,NULL,NULL,'grocery','simple','White Bread','white-bread','White Bread — everyday essential',NULL,NULL,45.00,NULL,NULL,'pack',0.400,'400 g','https://picsum.photos/seed/malviya-fresh-mart-white-bread/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(124,20,7,NULL,41,NULL,NULL,'grocery','simple','Aashirvaad Atta 5kg','aashirvaad-atta-5kg','Aashirvaad Atta 5kg — everyday essential',NULL,NULL,265.00,NULL,NULL,'kg',5.000,'5 kg','https://picsum.photos/seed/malviya-fresh-mart-aashirvaad-atta-5kg/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(125,20,7,NULL,47,NULL,NULL,'grocery','simple','Lays Classic Chips','lays-classic-chips','Lays Classic Chips — everyday essential',NULL,NULL,20.00,NULL,NULL,'pack',0.052,'52 g','https://picsum.photos/seed/malviya-fresh-mart-lays-classic-chips/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(126,20,7,NULL,52,NULL,NULL,'grocery','simple','Coca-Cola 750ml','coca-cola-750ml','Coca-Cola 750ml — everyday essential',NULL,NULL,40.00,NULL,NULL,'l',0.750,'750 ml','https://picsum.photos/seed/malviya-fresh-mart-coca-cola-750ml/600/400',NULL,1,0,1,1,1,NULL,NULL,NULL,NULL,5.00,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `referral_rules`
--

DROP TABLE IF EXISTS `referral_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `referral_rules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'customer',
  `referrer_reward` decimal(10,2) NOT NULL,
  `referee_reward` decimal(10,2) NOT NULL,
  `reward_type` enum('wallet','points','coupon') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'wallet',
  `min_orders_for_reward` int unsigned NOT NULL DEFAULT '1',
  `min_order_amount_threshold` decimal(10,2) NOT NULL DEFAULT '0.00',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `referral_rules`
--

LOCK TABLES `referral_rules` WRITE;
/*!40000 ALTER TABLE `referral_rules` DISABLE KEYS */;
INSERT INTO `referral_rules` VALUES (1,'customer',100.00,50.00,'wallet',1,100.00,1,'2026-09-18 04:12:14','2026-09-18 04:12:14');
/*!40000 ALTER TABLE `referral_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `referrals`
--

DROP TABLE IF EXISTS `referrals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `referrals` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `referrer_id` bigint unsigned NOT NULL,
  `referee_id` bigint unsigned NOT NULL,
  `referral_code` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `award_amount` decimal(10,2) DEFAULT NULL,
  `award_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'wallet',
  `rewarded_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `referrals_referrer_id_referee_id_unique` (`referrer_id`,`referee_id`),
  KEY `referrals_referee_id_foreign` (`referee_id`),
  KEY `referrals_referral_code_index` (`referral_code`),
  CONSTRAINT `referrals_referee_id_foreign` FOREIGN KEY (`referee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `referrals_referrer_id_foreign` FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `referrals`
--

LOCK TABLES `referrals` WRITE;
/*!40000 ALTER TABLE `referrals` DISABLE KEYS */;
/*!40000 ALTER TABLE `referrals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refunds`
--

DROP TABLE IF EXISTS `refunds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refunds` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `refund_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_id` bigint unsigned DEFAULT NULL,
  `user_id` bigint unsigned NOT NULL,
  `refundable_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `refundable_id` bigint unsigned DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `reason` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'REQUESTED',
  `provider_reference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `idempotency_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `refunds_refund_number_unique` (`refund_number`),
  UNIQUE KEY `refunds_idempotency_key_unique` (`idempotency_key`),
  UNIQUE KEY `refunds_provider_reference_unique` (`provider_reference`),
  KEY `refunds_payment_id_foreign` (`payment_id`),
  KEY `refunds_approved_by_foreign` (`approved_by`),
  KEY `refunds_refundable_type_refundable_id_index` (`refundable_type`,`refundable_id`),
  KEY `refunds_user_id_status_index` (`user_id`,`status`),
  CONSTRAINT `refunds_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `refunds_payment_id_foreign` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `refunds_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refunds`
--

LOCK TABLES `refunds` WRITE;
/*!40000 ALTER TABLE `refunds` DISABLE KEYS */;
/*!40000 ALTER TABLE `refunds` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `restaurants`
--

DROP TABLE IF EXISTS `restaurants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `restaurants` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `cuisine_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cover_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `opens_at` time DEFAULT NULL,
  `closes_at` time DEFAULT NULL,
  `is_open` tinyint(1) NOT NULL DEFAULT '1',
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `dine_in` tinyint(1) NOT NULL DEFAULT '0',
  `is_veg` tinyint(1) NOT NULL DEFAULT '0',
  `is_halal` tinyint(1) NOT NULL DEFAULT '0',
  `avg_prep_time_min` decimal(5,1) NOT NULL DEFAULT '20.0',
  `avg_delivery_time_min` decimal(5,1) NOT NULL DEFAULT '30.0',
  `rating` decimal(3,2) NOT NULL DEFAULT '0.00',
  `rating_count` int unsigned NOT NULL DEFAULT '0',
  `min_order_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `delivery_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `free_delivery_above` decimal(10,2) DEFAULT NULL,
  `opening_hours` json DEFAULT NULL,
  `holidays` json DEFAULT NULL,
  `order_type` enum('delivery','pickup','both') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'both',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `restaurants_slug_unique` (`slug`),
  KEY `restaurants_vendor_id_foreign` (`vendor_id`),
  KEY `restaurants_latitude_longitude_is_open_index` (`latitude`,`longitude`,`is_open`),
  KEY `restaurants_is_featured_index` (`is_featured`),
  KEY `restaurants_cuisine_type_index` (`cuisine_type`),
  CONSTRAINT `restaurants_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `restaurants`
--

LOCK TABLES `restaurants` WRITE;
/*!40000 ALTER TABLE `restaurants` DISABLE KEYS */;
INSERT INTO `restaurants` VALUES (1,6,'Spice Villa','spice-villa','Authentic North Indian cuisine with modern twists','North Indian, Mughlai','Connaught Place, New Delhi',26.8458270,75.8046652,'9812345678',NULL,NULL,'10:00:00','23:00:00',1,1,0,0,0,20.0,30.0,4.50,250,100.00,30.00,500.00,NULL,NULL,'both',NULL,'2026-09-18 04:12:15','2026-09-25 04:23:11',NULL),(2,8,'Rajasthani Rasoi','rajasthani-rasoi-jaipur','Authentic Rajasthani thalis, baati-churma and fiery Laal Maas','Rajasthani, North Indian','C-Scheme, Ashok Marg, Jaipur, Rajasthan 302001',26.9124000,75.7873000,'9812367000',NULL,NULL,'10:00:00','23:00:00',1,1,0,0,0,25.0,35.0,4.60,320,100.00,30.00,499.00,NULL,NULL,'both',NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL),(3,9,'Handi Restaurant','handi-restaurant','Rajasthani, North Indian specialities served fresh in Jaipur','Rajasthani, North Indian','C-Scheme, Ashok Marg, Jaipur',26.9124000,75.7873000,'9812378261',NULL,NULL,'10:00:00','23:00:00',1,1,0,0,0,25.0,35.0,4.50,143,100.00,30.00,499.00,NULL,NULL,'both',NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(4,10,'Laxmi Mishthan Bhandar','laxmi-mishthan-bhandar','Rajasthani Sweets, Vegetarian specialities served fresh in Jaipur','Rajasthani Sweets, Vegetarian','Johari Bazaar, Jaipur',26.9180000,75.8260000,'9812372419',NULL,NULL,'10:00:00','23:00:00',1,1,0,1,0,25.0,35.0,4.70,131,100.00,30.00,499.00,NULL,NULL,'both',NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL),(5,13,'Vidhyadhar Dhaba','vidhyadhar-dhaba','North Indian, Dhaba specialities served fresh in Jaipur','North Indian, Dhaba','Vidhyadhar Nagar, Jaipur',26.9600000,75.7900000,'9812374327',NULL,NULL,'10:00:00','23:00:00',1,1,0,0,0,25.0,35.0,4.30,227,100.00,30.00,499.00,NULL,NULL,'both',NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(6,14,'Jhotwara Kitchen','jhotwara-kitchen','Rajasthani, Chinese specialities served fresh in Jaipur','Rajasthani, Chinese','Jhotwara, Jaipur',26.9450000,75.7450000,'9812374631',NULL,NULL,'10:00:00','23:00:00',1,1,0,0,0,25.0,35.0,4.20,352,100.00,30.00,499.00,NULL,NULL,'both',NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(7,17,'Jagatpura Spice Court','jagatpura-spice-court','North Indian, Mughlai specialities served fresh in Jaipur','North Indian, Mughlai','Jagatpura, Jaipur',26.8457000,75.8048000,'9812372187',NULL,NULL,'10:00:00','23:00:00',1,1,0,0,0,25.0,35.0,4.40,384,100.00,30.00,499.00,NULL,NULL,'both',NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(8,18,'Sitapura Biryani House','sitapura-biryani-house','Hyderabadi, Biryani specialities served fresh in Jaipur','Hyderabadi, Biryani','Sitapura, Jaipur',26.8300000,75.7500000,'9812373243',NULL,NULL,'10:00:00','23:00:00',1,1,0,0,0,25.0,35.0,4.60,287,100.00,30.00,499.00,NULL,NULL,'both',NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(9,21,'food delivery vendor2','food-delivery-vendor2',NULL,NULL,'waplia digital solutions, malviya nagar, jaipur, rajasthan',26.8456854,75.8047638,'7676767676',NULL,NULL,NULL,NULL,0,0,0,0,0,20.0,30.0,0.00,0,0.00,0.00,NULL,NULL,NULL,'both',NULL,'2026-09-21 03:26:10','2026-09-21 03:27:01',NULL),(10,23,'food vendor3','food-vendor3',NULL,NULL,'sujag apartment, mansarovar, jaipur',NULL,NULL,'5454536464',NULL,NULL,NULL,NULL,0,0,0,0,0,20.0,30.0,0.00,0,0.00,0.00,NULL,NULL,NULL,'both',NULL,'2026-09-21 05:08:36','2026-09-21 05:08:36',NULL);
/*!40000 ALTER TABLE `restaurants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `reviewable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reviewable_id` bigint unsigned NOT NULL,
  `order_id` bigint unsigned DEFAULT NULL,
  `rating` decimal(2,1) NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `images` json DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `helpful_count` int NOT NULL DEFAULT '0',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reviews_user_id_reviewable_type_reviewable_id_order_id_unique` (`user_id`,`reviewable_type`,`reviewable_id`,`order_id`),
  KEY `reviews_reviewable_type_reviewable_id_index` (`reviewable_type`,`reviewable_id`),
  KEY `reviews_user_id_status_index` (`user_id`,`status`),
  CONSTRAINT `reviews_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ride_ratings`
--

DROP TABLE IF EXISTS `ride_ratings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ride_ratings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ride_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `rating` decimal(2,1) NOT NULL DEFAULT '5.0',
  `comment` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ride_ratings_ride_id_user_id_unique` (`ride_id`,`user_id`),
  KEY `ride_ratings_user_id_foreign` (`user_id`),
  CONSTRAINT `ride_ratings_ride_id_foreign` FOREIGN KEY (`ride_id`) REFERENCES `rides` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ride_ratings_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ride_ratings`
--

LOCK TABLES `ride_ratings` WRITE;
/*!40000 ALTER TABLE `ride_ratings` DISABLE KEYS */;
/*!40000 ALTER TABLE `ride_ratings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ride_requests`
--

DROP TABLE IF EXISTS `ride_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ride_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ride_id` bigint unsigned NOT NULL,
  `driver_id` bigint unsigned DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `distance_km` decimal(8,2) DEFAULT NULL,
  `sent_at` timestamp NULL DEFAULT NULL,
  `responded_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `attempt` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ride_requests_driver_id_foreign` (`driver_id`),
  KEY `ride_requests_ride_id_status_index` (`ride_id`,`status`),
  CONSTRAINT `ride_requests_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ride_requests_ride_id_foreign` FOREIGN KEY (`ride_id`) REFERENCES `rides` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ride_requests`
--

LOCK TABLES `ride_requests` WRITE;
/*!40000 ALTER TABLE `ride_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `ride_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ride_status_histories`
--

DROP TABLE IF EXISTS `ride_status_histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ride_status_histories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ride_id` bigint unsigned NOT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ride_status_histories_changed_by_foreign` (`changed_by`),
  KEY `ride_status_histories_ride_id_status_index` (`ride_id`,`status`),
  CONSTRAINT `ride_status_histories_changed_by_foreign` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ride_status_histories_ride_id_foreign` FOREIGN KEY (`ride_id`) REFERENCES `rides` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ride_status_histories`
--

LOCK TABLES `ride_status_histories` WRITE;
/*!40000 ALTER TABLE `ride_status_histories` DISABLE KEYS */;
/*!40000 ALTER TABLE `ride_status_histories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rides`
--

DROP TABLE IF EXISTS `rides`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rides` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ride_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `driver_id` bigint unsigned DEFAULT NULL,
  `vehicle_id` bigint unsigned DEFAULT NULL,
  `vehicle_type_id` bigint unsigned DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'REQUESTED',
  `pickup_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pickup_latitude` decimal(10,7) NOT NULL,
  `pickup_longitude` decimal(10,7) NOT NULL,
  `destination_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `destination_latitude` decimal(10,7) NOT NULL,
  `pickup_zone_id` bigint unsigned DEFAULT NULL,
  `destination_zone_id` bigint unsigned DEFAULT NULL,
  `destination_longitude` decimal(10,7) NOT NULL,
  `pickup_latitude_actual` decimal(10,7) DEFAULT NULL,
  `pickup_longitude_actual` decimal(10,7) DEFAULT NULL,
  `destination_latitude_actual` decimal(10,7) DEFAULT NULL,
  `destination_longitude_actual` decimal(10,7) DEFAULT NULL,
  `distance_km` decimal(8,2) DEFAULT NULL,
  `duration_min` int unsigned DEFAULT NULL,
  `base_fare` decimal(10,2) NOT NULL DEFAULT '0.00',
  `distance_charge` decimal(10,2) NOT NULL DEFAULT '0.00',
  `time_charge` decimal(10,2) NOT NULL DEFAULT '0.00',
  `booking_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `platform_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `surge_multiplier` decimal(4,2) NOT NULL DEFAULT '1.00',
  `surge_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `waiting_charge` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tip_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `estimated_fare` decimal(10,2) NOT NULL DEFAULT '0.00',
  `final_fare` decimal(10,2) DEFAULT NULL,
  `coupon_code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wallet_used` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_method` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `otp` varchar(6) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp_verified` tinyint(1) NOT NULL DEFAULT '0',
  `otp_verified_at` timestamp NULL DEFAULT NULL,
  `is_scheduled` tinyint(1) NOT NULL DEFAULT '0',
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `driver_assigned_at` timestamp NULL DEFAULT NULL,
  `driver_arriving_at` timestamp NULL DEFAULT NULL,
  `driver_arrived_at` timestamp NULL DEFAULT NULL,
  `trip_started_at` timestamp NULL DEFAULT NULL,
  `trip_completed_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancel_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelled_by_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelled_by` bigint unsigned DEFAULT NULL,
  `route` json DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `cash_collected` tinyint(1) NOT NULL DEFAULT '0',
  `cash_collected_amount` decimal(10,2) DEFAULT NULL,
  `cash_collected_at` timestamp NULL DEFAULT NULL,
  `cash_collected_via` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cash_settled` tinyint(1) NOT NULL DEFAULT '0',
  `cash_settled_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rides_ride_number_unique` (`ride_number`),
  KEY `rides_vehicle_id_foreign` (`vehicle_id`),
  KEY `rides_vehicle_type_id_foreign` (`vehicle_type_id`),
  KEY `rides_cancelled_by_foreign` (`cancelled_by`),
  KEY `rides_user_id_status_index` (`user_id`,`status`),
  KEY `rides_driver_id_status_index` (`driver_id`,`status`),
  KEY `rides_status_created_at_index` (`status`,`created_at`),
  KEY `rides_pickup_zone_id_foreign` (`pickup_zone_id`),
  KEY `rides_destination_zone_id_foreign` (`destination_zone_id`),
  CONSTRAINT `rides_cancelled_by_foreign` FOREIGN KEY (`cancelled_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rides_destination_zone_id_foreign` FOREIGN KEY (`destination_zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rides_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rides_pickup_zone_id_foreign` FOREIGN KEY (`pickup_zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rides_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rides_vehicle_id_foreign` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rides_vehicle_type_id_foreign` FOREIGN KEY (`vehicle_type_id`) REFERENCES `vehicle_types` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rides`
--

LOCK TABLES `rides` WRITE;
/*!40000 ALTER TABLE `rides` DISABLE KEYS */;
/*!40000 ALTER TABLE `rides` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `risk_score_logs`
--

DROP TABLE IF EXISTS `risk_score_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `risk_score_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `risk_score` int NOT NULL DEFAULT '0',
  `level` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'low',
  `factors` json DEFAULT NULL,
  `action` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `review_pending` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `risk_score_logs_user_id_created_at_index` (`user_id`,`created_at`),
  KEY `risk_score_logs_risk_score_index` (`risk_score`),
  CONSTRAINT `risk_score_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `risk_score_logs`
--

LOCK TABLES `risk_score_logs` WRITE;
/*!40000 ALTER TABLE `risk_score_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `risk_score_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permission`
--

DROP TABLE IF EXISTS `role_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permission` (
  `role_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `role_permission_permission_id_foreign` (`permission_id`),
  CONSTRAINT `role_permission_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_permission_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permission`
--

LOCK TABLES `role_permission` WRITE;
/*!40000 ALTER TABLE `role_permission` DISABLE KEYS */;
INSERT INTO `role_permission` VALUES (3,1),(3,2),(3,3),(3,4),(3,5),(3,6),(3,7),(3,8),(3,9),(3,10),(3,11),(3,12),(3,13),(3,14),(3,15),(3,16),(3,17),(3,18),(3,19),(3,20),(3,21),(3,22),(3,23),(3,24),(3,25),(3,26),(3,27),(3,28),(3,29),(3,30),(3,31),(3,32),(3,33),(3,34),(3,35),(3,36),(3,37),(3,38),(3,39),(3,40),(3,41),(3,42),(3,43),(3,44),(3,45),(3,46),(3,47),(3,48),(3,49),(3,50),(3,51),(3,52),(3,53),(3,54),(3,55),(4,55),(5,55),(8,55),(9,55),(10,55),(3,56),(4,56),(5,56),(3,57),(4,57),(5,57),(9,57),(10,57),(3,58),(4,58),(5,58),(3,59),(4,59),(3,60),(4,60),(3,61),(4,61),(3,62),(4,62),(3,63),(4,63),(5,63),(3,64),(9,64),(10,64),(3,65),(9,65),(10,65),(3,66),(9,66),(10,66),(3,67),(9,67),(10,67),(3,68),(9,68),(10,68),(3,69),(9,69),(10,69),(3,70),(9,70),(10,70),(3,71),(9,71),(10,71),(3,72),(9,72),(10,72),(3,73),(3,74),(3,75),(3,76),(3,77),(3,78),(3,79),(3,80),(3,81),(3,82),(3,83),(3,84),(3,85),(3,86),(3,87),(3,88),(3,89),(3,90),(3,91),(3,92),(3,93),(3,94),(3,95),(3,96),(3,97),(3,98),(3,99),(3,100),(3,101),(3,102),(3,103),(3,104),(3,105),(3,106),(3,107),(3,108),(3,109),(3,110),(3,111),(3,112),(3,113),(3,114),(3,115),(3,116),(3,117),(3,118),(3,119),(3,120),(3,121),(3,122),(3,123),(3,124),(3,125),(3,126),(3,127),(3,128),(3,129),(3,130),(3,131),(3,132),(3,133),(3,134),(3,135),(3,136),(3,137),(3,138),(3,139),(3,140),(3,141),(3,142),(3,143),(3,144),(3,145),(3,146),(3,147),(3,148),(3,149),(3,150),(3,151),(3,152),(3,153),(3,154),(3,155),(3,156),(3,157),(3,158),(3,159),(3,160),(3,161),(3,162),(3,163),(3,164),(3,165),(3,166),(3,167),(3,168),(3,169),(3,170),(3,171),(3,172),(3,173),(3,174),(3,175),(3,176),(3,177),(3,178),(3,179),(3,180),(3,181),(3,182),(3,183),(3,184),(3,185),(3,186),(3,187),(3,188),(3,189),(3,190),(3,191),(3,192),(3,193),(3,194),(3,195),(3,196),(3,197),(3,198),(3,199),(3,200),(3,201),(3,202),(3,203),(3,204),(3,205),(3,206),(3,207),(3,208),(3,209),(3,210),(3,211),(3,212),(3,213),(3,214),(3,215),(3,216),(3,217),(3,218),(3,219),(3,220),(3,221),(3,222),(3,223),(3,224),(3,225),(3,226),(3,227),(3,228),(3,229),(3,230),(3,231),(3,232),(3,233),(3,234),(3,235),(3,236),(3,237),(3,238),(3,239),(3,240),(3,241),(3,242),(3,243),(3,244),(3,245),(3,246),(3,247),(3,248),(3,249),(3,250),(3,251),(3,252),(3,253),(3,254),(3,255),(3,256),(3,257),(3,258),(3,259),(3,260),(3,261),(3,262),(3,263),(3,264),(3,265),(3,266),(3,267),(3,268),(3,269),(3,270),(3,271),(3,272),(3,273),(3,274),(3,275),(3,276),(3,277),(3,278),(3,279),(3,280),(3,281),(3,282),(3,283),(3,284),(3,285),(3,286),(3,287),(3,288),(3,289),(3,290),(3,291),(3,292),(3,293),(3,294),(3,295),(3,296),(3,297),(3,298),(3,299),(3,300),(3,301),(3,302),(3,303),(3,304),(3,305),(3,306),(3,307),(3,308),(3,309),(3,310),(3,311),(3,312),(3,313),(3,314),(3,315),(3,316),(3,317),(3,318),(3,319),(3,320),(3,321),(3,322),(3,323),(3,324),(3,325),(3,326),(3,327),(3,328),(3,329),(3,330),(3,331),(3,332),(3,333),(3,334),(3,335),(3,336),(3,337),(3,338),(3,339),(3,340),(3,341),(3,342),(3,343),(3,344),(3,345),(3,346),(3,347),(3,348),(3,349),(3,350),(3,351),(3,352),(3,353),(3,354),(3,355),(3,356),(3,357),(3,358),(3,359),(3,360),(3,361),(3,362),(3,363),(3,364),(3,365),(3,366),(3,367),(3,368),(3,369),(3,370),(3,371),(3,372),(3,373),(3,374),(3,375),(3,376),(3,377),(3,378),(3,379),(3,380),(3,381),(3,382),(3,383),(3,384),(3,385),(3,386),(3,387),(3,388),(3,389),(3,390),(3,391),(3,392),(3,393),(3,394),(3,395),(3,396),(3,397),(3,398),(3,399),(3,400),(3,401),(3,402),(3,403),(3,404),(3,405),(3,406),(3,407),(3,408),(3,409),(3,410),(3,411),(3,412),(3,413),(3,414),(3,415),(3,416),(3,417),(3,418),(3,419),(3,420),(3,421),(3,422),(3,423),(3,424),(3,425),(3,426),(3,427),(3,428),(3,429),(3,430),(3,431),(3,432),(3,433),(3,434),(3,435),(3,436),(3,437),(3,438),(3,439),(3,440),(3,441),(3,442),(3,443),(3,444),(3,445),(3,446),(3,447),(3,448),(3,449),(3,450),(3,451),(3,452),(3,453),(3,454),(3,455),(3,456),(3,457),(3,458),(3,459),(3,460),(4,460),(5,460),(3,461),(4,461),(5,461),(3,462),(4,462),(5,462),(8,462),(10,462),(3,463),(9,463),(10,463),(3,464),(9,464),(10,464);
/*!40000 ALTER TABLE `role_permission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_name_unique` (`name`),
  UNIQUE KEY `roles_slug_unique` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (3,'Super Admin','super_admin',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(4,'Admin','admin',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(5,'Operations Admin','operations_admin',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(6,'Finance Admin','finance_admin',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(7,'Support Admin','support_admin',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(8,'Marketing Admin','marketing_admin',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(9,'Vendor','vendor',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(10,'Vendor Manager','vendor_manager',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(11,'Delivery Partner','delivery_partner',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(12,'Driver','driver',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(13,'Customer','customer',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12'),(14,'Customer Support','customer_support',NULL,1,'2026-09-18 04:12:12','2026-09-18 04:12:12');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `saved_places`
--

DROP TABLE IF EXISTS `saved_places`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `saved_places` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `saved_places_user_id_label_index` (`user_id`,`label`),
  CONSTRAINT `saved_places_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `saved_places`
--

LOCK TABLES `saved_places` WRITE;
/*!40000 ALTER TABLE `saved_places` DISABLE KEYS */;
/*!40000 ALTER TABLE `saved_places` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_areas`
--

DROP TABLE IF EXISTS `service_areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_areas` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `zone_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'India',
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `radius_km` decimal(8,2) NOT NULL DEFAULT '5.00',
  `polygon` json DEFAULT NULL,
  `food_available` tinyint(1) NOT NULL DEFAULT '1',
  `grocery_available` tinyint(1) NOT NULL DEFAULT '1',
  `rides_available` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `service_areas_zone_id_foreign` (`zone_id`),
  CONSTRAINT `service_areas_zone_id_foreign` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_areas`
--

LOCK TABLES `service_areas` WRITE;
/*!40000 ALTER TABLE `service_areas` DISABLE KEYS */;
INSERT INTO `service_areas` VALUES (1,1,'C-Scheme','Jaipur','Rajasthan','India',26.9124000,75.7873000,5.00,NULL,1,1,1,1,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(2,1,'Vaishali Nagar','Jaipur','Rajasthan','India',26.9040000,75.7400000,5.00,NULL,1,1,1,1,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(3,1,'Malviya Nagar','Jaipur','Rajasthan','India',26.8550000,75.8100000,5.00,NULL,1,1,1,1,'2026-09-18 04:12:14','2026-09-18 04:12:14');
/*!40000 ALTER TABLE `service_areas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settlement_items`
--

DROP TABLE IF EXISTS `settlement_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settlement_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `settlement_id` bigint unsigned NOT NULL,
  `source_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` bigint unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `direction` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `settlement_items_settlement_id_foreign` (`settlement_id`),
  KEY `settlement_items_source_type_source_id_index` (`source_type`,`source_id`),
  CONSTRAINT `settlement_items_settlement_id_foreign` FOREIGN KEY (`settlement_id`) REFERENCES `settlements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settlement_items`
--

LOCK TABLES `settlement_items` WRITE;
/*!40000 ALTER TABLE `settlement_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `settlement_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settlements`
--

DROP TABLE IF EXISTS `settlements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settlements` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `settlement_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `party_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor_id` bigint unsigned DEFAULT NULL,
  `driver_id` bigint unsigned DEFAULT NULL,
  `delivery_partner_id` bigint unsigned DEFAULT NULL,
  `gross_earnings` decimal(12,2) NOT NULL,
  `total_commission` decimal(12,2) NOT NULL,
  `total_incentives` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_bonuses` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_adjustments` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_refunds` decimal(12,2) NOT NULL DEFAULT '0.00',
  `net_payable` decimal(12,2) NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `period_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'weekly',
  `approved_at` timestamp NULL DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `payout_id` bigint unsigned DEFAULT NULL,
  `breakdown` json DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `settlements_settlement_number_unique` (`settlement_number`),
  KEY `settlements_approved_by_foreign` (`approved_by`),
  KEY `settlements_party_type_status_index` (`party_type`,`status`),
  KEY `settlements_vendor_id_period_start_period_end_index` (`vendor_id`,`period_start`,`period_end`),
  KEY `settlements_driver_id_period_start_period_end_index` (`driver_id`,`period_start`,`period_end`),
  KEY `settlements_delivery_partner_id_period_start_period_end_index` (`delivery_partner_id`,`period_start`,`period_end`),
  CONSTRAINT `settlements_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `settlements_delivery_partner_id_foreign` FOREIGN KEY (`delivery_partner_id`) REFERENCES `delivery_partners` (`id`) ON DELETE SET NULL,
  CONSTRAINT `settlements_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `settlements_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settlements`
--

LOCK TABLES `settlements` WRITE;
/*!40000 ALTER TABLE `settlements` DISABLE KEYS */;
/*!40000 ALTER TABLE `settlements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `states`
--

DROP TABLE IF EXISTS `states`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `states` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `country_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `states_country_id_foreign` (`country_id`),
  CONSTRAINT `states_country_id_foreign` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `states`
--

LOCK TABLES `states` WRITE;
/*!40000 ALTER TABLE `states` DISABLE KEYS */;
INSERT INTO `states` VALUES (1,1,'Rajasthan','RJ',1,'2026-09-18 04:12:14','2026-09-18 04:12:14');
/*!40000 ALTER TABLE `states` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stores`
--

DROP TABLE IF EXISTS `stores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stores` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `store_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'supermarket',
  `description` text COLLATE utf8mb4_unicode_ci,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cover_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `opens_at` time DEFAULT NULL,
  `closes_at` time DEFAULT NULL,
  `is_open` tinyint(1) NOT NULL DEFAULT '1',
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `rating` decimal(3,2) NOT NULL DEFAULT '0.00',
  `rating_count` int unsigned NOT NULL DEFAULT '0',
  `min_order_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `delivery_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `opening_hours` json DEFAULT NULL,
  `holidays` json DEFAULT NULL,
  `order_type` enum('delivery','pickup','both') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'both',
  `supports_instant_delivery` tinyint(1) NOT NULL DEFAULT '1',
  `supports_scheduled_delivery` tinyint(1) NOT NULL DEFAULT '1',
  `substitution_policy` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'contact',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stores_slug_unique` (`slug`),
  KEY `stores_vendor_id_foreign` (`vendor_id`),
  KEY `stores_latitude_longitude_is_open_index` (`latitude`,`longitude`,`is_open`),
  KEY `stores_store_type_index` (`store_type`),
  CONSTRAINT `stores_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stores`
--

LOCK TABLES `stores` WRITE;
/*!40000 ALTER TABLE `stores` DISABLE KEYS */;
INSERT INTO `stores` VALUES (1,7,'FreshMart Supermarket','freshmart-supermarket','supermarket','Everything you need for your weekly groceries','Janpath, New Delhi',26.8457243,75.8047489,'9823456789',NULL,NULL,'08:00:00','22:00:00',1,1,4.30,180,200.00,40.00,NULL,NULL,'both',1,1,'contact',NULL,'2026-09-18 04:12:15','2026-09-28 01:07:54',NULL),(2,11,'Jaipur Grocers','jaipur-grocers','supermarket','Daily groceries and essentials delivered across Jaipur Central Zone','Ashok Nagar, Jaipur',26.9080000,75.8000000,'9812374294',NULL,NULL,'08:00:00','22:00:00',1,1,4.90,290,200.00,40.00,NULL,NULL,'both',1,1,'contact',NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(3,12,'Pink City Supermart','pink-city-supermart','supermarket','Daily groceries and essentials delivered across Jaipur Central Zone','MI Road, Jaipur',26.9150000,75.7800000,'9812373184',NULL,NULL,'08:00:00','22:00:00',1,1,4.00,86,200.00,40.00,NULL,NULL,'both',1,1,'contact',NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL),(4,15,'North Mart','north-mart','supermarket','Daily groceries and essentials delivered across Jaipur North Zone','Mansarovar, Jaipur',26.9550000,75.7700000,'9812370181',NULL,NULL,'08:00:00','22:00:00',1,1,4.90,108,200.00,40.00,NULL,NULL,'both',1,1,'contact',NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(5,16,'Sodala Daily Needs','sodala-daily-needs','convenience','Daily groceries and essentials delivered across Jaipur North Zone','Sodala, Jaipur',26.9350000,75.7600000,'9812370892',NULL,NULL,'08:00:00','22:00:00',1,1,4.50,264,200.00,40.00,NULL,NULL,'both',1,1,'contact',NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL),(6,19,'South Super Bazaar','south-super-bazaar','supermarket','Daily groceries and essentials delivered across Jaipur South Zone','Sitapura, Jaipur',26.8400000,75.7600000,'9812370034',NULL,NULL,'08:00:00','22:00:00',1,1,4.30,204,200.00,40.00,NULL,NULL,'both',1,1,'contact',NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL),(7,20,'Malviya Fresh Mart','malviya-fresh-mart','supermarket','Daily groceries and essentials delivered across Jaipur South Zone','Malviya Nagar, Jaipur',26.8550000,75.8100000,'9812374512',NULL,NULL,'08:00:00','22:00:00',1,1,4.10,146,200.00,40.00,NULL,NULL,'both',1,1,'contact',NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL);
/*!40000 ALTER TABLE `stores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_messages`
--

DROP TABLE IF EXISTS `support_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ticket_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `attachments` json DEFAULT NULL,
  `is_internal` tinyint(1) NOT NULL DEFAULT '0',
  `is_from_customer` tinyint(1) NOT NULL DEFAULT '0',
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `support_messages_ticket_id_foreign` (`ticket_id`),
  KEY `support_messages_user_id_foreign` (`user_id`),
  CONSTRAINT `support_messages_ticket_id_foreign` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `support_messages_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_messages`
--

LOCK TABLES `support_messages` WRITE;
/*!40000 ALTER TABLE `support_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `support_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `support_tickets`
--

DROP TABLE IF EXISTS `support_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_tickets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ticket_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `ticket_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `priority` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `assigned_to` bigint unsigned DEFAULT NULL,
  `reference_id` bigint unsigned DEFAULT NULL,
  `reference_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `due_at` timestamp NULL DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `support_tickets_ticket_number_unique` (`ticket_number`),
  KEY `support_tickets_assigned_to_foreign` (`assigned_to`),
  KEY `support_tickets_status_priority_index` (`status`,`priority`),
  KEY `support_tickets_user_id_status_index` (`user_id`,`status`),
  CONSTRAINT `support_tickets_assigned_to_foreign` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `support_tickets_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `support_tickets`
--

LOCK TABLES `support_tickets` WRITE;
/*!40000 ALTER TABLE `support_tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `support_tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tax_rules`
--

DROP TABLE IF EXISTS `tax_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_rules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('percentage','fixed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'percentage',
  `rate` decimal(8,2) NOT NULL DEFAULT '0.00',
  `country_code` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tax_rules`
--

LOCK TABLES `tax_rules` WRITE;
/*!40000 ALTER TABLE `tax_rules` DISABLE KEYS */;
INSERT INTO `tax_rules` VALUES (1,'Food GST 5%','food','percentage',5.00,'IN',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(2,'Grocery GST 5%','grocery','percentage',5.00,'IN',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(3,'Ride GST 5%','ride','percentage',5.00,'IN',1,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14');
/*!40000 ALTER TABLE `tax_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_devices`
--

DROP TABLE IF EXISTS `user_devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_devices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `device_token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `app_version` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_devices_user_id_foreign` (`user_id`),
  CONSTRAINT `user_devices_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_devices`
--

LOCK TABLES `user_devices` WRITE;
/*!40000 ALTER TABLE `user_devices` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_devices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `role_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_roles_user_id_role_id_unique` (`user_id`,`role_id`),
  KEY `user_roles_role_id_foreign` (`role_id`),
  CONSTRAINT `user_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_roles_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (3,13,3,NULL,NULL),(4,14,13,NULL,NULL),(5,15,9,NULL,NULL),(6,16,9,NULL,NULL),(7,17,12,NULL,NULL),(8,18,11,NULL,NULL),(9,19,13,NULL,NULL),(10,20,9,NULL,NULL),(11,21,11,NULL,NULL),(12,22,11,NULL,NULL),(13,23,11,NULL,NULL),(14,24,11,NULL,NULL),(15,25,11,NULL,NULL),(16,26,9,NULL,NULL),(17,27,9,NULL,NULL),(18,28,9,NULL,NULL),(19,29,9,NULL,NULL),(20,30,9,NULL,NULL),(21,31,9,NULL,NULL),(22,32,9,NULL,NULL),(23,33,9,NULL,NULL),(24,34,9,NULL,NULL),(25,35,9,NULL,NULL),(26,36,9,NULL,NULL),(27,37,9,NULL,NULL),(28,38,11,NULL,NULL),(29,39,11,NULL,NULL),(30,40,11,NULL,NULL),(31,41,11,NULL,NULL),(32,42,11,NULL,NULL),(33,43,12,NULL,NULL),(34,44,12,NULL,NULL),(35,45,12,NULL,NULL),(36,46,11,NULL,NULL),(37,47,11,NULL,NULL),(38,48,11,NULL,NULL),(39,49,11,NULL,NULL),(40,50,11,NULL,NULL),(41,51,12,NULL,NULL),(42,52,12,NULL,NULL),(43,53,12,NULL,NULL),(44,54,11,NULL,NULL),(45,55,11,NULL,NULL),(46,56,11,NULL,NULL),(47,57,11,NULL,NULL),(48,58,11,NULL,NULL),(49,59,12,NULL,NULL),(50,60,12,NULL,NULL),(51,61,12,NULL,NULL),(53,63,11,NULL,NULL),(54,65,11,NULL,NULL),(55,66,12,NULL,NULL),(56,67,12,NULL,NULL),(57,68,9,NULL,NULL),(59,70,9,NULL,NULL);
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_search_history`
--

DROP TABLE IF EXISTS `user_search_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_search_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `query` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `results` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_search_history_user_id_created_at_index` (`user_id`,`created_at`),
  CONSTRAINT `user_search_history_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_search_history`
--

LOCK TABLES `user_search_history` WRITE;
/*!40000 ALTER TABLE `user_search_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_search_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '+91',
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `google_sub` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auth_provider` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `google_linked_at` timestamp NULL DEFAULT NULL,
  `avatar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referral_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referred_by` bigint unsigned DEFAULT NULL,
  `user_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'customer',
  `language` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'en',
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `timezone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Asia/Kolkata',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_verified` tinyint(1) NOT NULL DEFAULT '0',
  `phone_verified_at` timestamp NULL DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `last_login_ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fcm_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notification_preferences` json DEFAULT NULL,
  `privacy_settings` json DEFAULT NULL,
  `rating` decimal(3,2) NOT NULL DEFAULT '0.00',
  `rating_count` int unsigned NOT NULL DEFAULT '0',
  `banned_at` timestamp NULL DEFAULT NULL,
  `ban_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `users_phone_unique` (`phone`),
  UNIQUE KEY `users_referral_code_unique` (`referral_code`),
  UNIQUE KEY `users_google_sub_unique` (`google_sub`),
  KEY `users_referred_by_foreign` (`referred_by`),
  KEY `users_user_type_is_active_index` (`user_type`,`is_active`),
  KEY `users_phone_index` (`phone`),
  CONSTRAINT `users_referred_by_foreign` FOREIGN KEY (`referred_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (13,'Super Admin','admin@superapp.com','9999999999','+91','$2y$12$vRVA0c3FUCZV3Z7siQyDfulzMatFXyYRpnr.2IGOEXTTzjRo9/Bt.',NULL,NULL,NULL,NULL,'ADMIN01',NULL,'admin','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:14','2026-09-18 04:12:14','2026-09-21 03:21:55','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:14','2026-09-21 03:21:55'),(14,'Test Customer','customer@superapp.com','9876543210','+91','$2y$12$2lhCbz8wzGXfaICEMIQqkOf0VAmC8E2BmQlJDLLVBRpTOlrz0XeB2',NULL,NULL,NULL,NULL,'CUST99',NULL,'customer','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:14','2026-09-18 04:12:14','2026-09-25 06:19:20','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:14','2026-09-25 06:19:20'),(15,'Spice Villa Restaurant','restaurant@superapp.com','9812345678','+91','$2y$12$3H48ti6.Q7CAy384enTRROzH1EbK8VEHD1eeap.qfMlb5TycX5MOm',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,NULL,NULL,'2026-09-28 00:40:21','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-28 00:40:21'),(16,'FreshMart Grocery','grocery@superapp.com','9823456789','+91','$2y$12$C1VvEj/Sz97XmzWLM9eFUesyXz.yHc9VMrLlnUzBC8u9ghJsK9y3C',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,0,NULL,NULL,'2026-09-28 00:46:30','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-28 00:46:30'),(17,'Test Driver','driver@superapp.com','9765432100','+91','$2y$12$pZ6dlJNSacaUJU2YOT2U5OecrjasCCHw4cbgt9.DVKutqrgemZgkK',NULL,NULL,NULL,NULL,NULL,NULL,'driver','en','INR','Asia/Kolkata',1,1,NULL,NULL,'2026-09-18 06:54:22','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 06:54:22'),(18,'Test Delivery Partner','partner@superapp.com','9754321000','+91','$2y$12$/cNEQncAteuKSLsNr168YOqT1.sVQxPmbsuO7WYHyxT3P8tphOrH.',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(19,'Jaipur Customer','customer.jaipur@superapp.com','9876511111','+91','$2y$12$QPjADa0VibDrG7UESyRtUum9cOV3xtzScAGKsJSQWgsw0y5NKnCYO',NULL,NULL,NULL,NULL,'JAICUST',NULL,'customer','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:16','2026-09-18 04:12:16',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16'),(20,'Rajasthani Rasoi','vendor.jaipur@superapp.com','9812367000','+91','$2y$12$WYzf7G5BfCaNShhbFHmwUukEsSHwtIi0IOFmmX5xmeRC1h5Yk24lG',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16'),(21,'Jaipur Partner 1','partner.jaipur1@superapp.com','9754311001','+91','$2y$12$9KhPc8usrXC1M7.yjDfxc.9f4lmhxFed4P1Od4Q24ACAjTOTh.iIi',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16'),(22,'Jaipur Partner 2','partner.jaipur2@superapp.com','9754311002','+91','$2y$12$QHVobqvO5G1qjWdVsZ1z4O.CAJrvKqy9ZsgbGN1ZXJij0mHvWk1mG',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16'),(23,'Jaipur Partner 3','partner.jaipur3@superapp.com','9754311003','+91','$2y$12$WLpPCdjn0j8o8igGO60cmO2HD07zswVKPGOAcGzMT8vig7tCBQqKi',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(24,'Jaipur Partner 4','partner.jaipur4@superapp.com','9754311004','+91','$2y$12$3xsaMJvjWOmJcKbYLornsefsWBXQR6xZP7nGLAbDM9IMimExzsat.',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(25,'Jaipur Partner 5','partner.jaipur5@superapp.com','9754311005','+91','$2y$12$LG3p2qbN6tIdyJT4PAs6YeS7/0/BVbJ/hUOv7dvzjrM2t7aMqypiC',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(26,'Handi Restaurant','vendor.jaipur.handi-restaurant@superapp.com','9812378261','+91','$2y$12$nHn2bzvEUAHncd32qTcyi.LuQo.rehp.CoN/7ekNGnvNFq8i8y3Cm',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(27,'Laxmi Mishthan Bhandar','vendor.jaipur.laxmi-mishthan-bhandar@superapp.com','9812372419','+91','$2y$12$kr3mR4iBCs.JvM1ZJ1u7qup4eZ90c9ITTFQ9nuSPUnfWkkwnt1DIa',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:17','2026-09-18 04:12:17',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(28,'Jaipur Grocers','vendor.jaipur.jaipur-grocers@superapp.com','9812374294','+91','$2y$12$TZa4qSZo2bDm/J3RVexssuAiSf1EY56iq6ERw06NE0Sgh3KHhrsmq',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(29,'Pink City Supermart','vendor.jaipur.pink-city-supermart@superapp.com','9812373184','+91','$2y$12$71snk3aFIyiM6CJloO6Hve4y2YdGI/duRODnXnRsyliu58Opdprha',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(30,'Vidhyadhar Dhaba','vendor.jaipur.vidhyadhar-dhaba@superapp.com','9812374327','+91','$2y$12$apL4xy0lXMZ9iZ4TtR.9me/9FkbYOVFRrw4cLwGvG4ppAYkZ4Ff5m',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(31,'Jhotwara Kitchen','vendor.jaipur.jhotwara-kitchen@superapp.com','9812374631','+91','$2y$12$qwK/UQTfQqEMFrS2fc839eHQ.S.hfKXSTud5n7DsTzmK7LA2d4yrG',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:18','2026-09-18 04:12:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(32,'North Mart','vendor.jaipur.north-mart@superapp.com','9812370181','+91','$2y$12$AVTfyMe7DUvvomKC7r97teIwn78M9qo109SEfyuq2MIwHqg1kGCLi',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(33,'Sodala Daily Needs','vendor.jaipur.sodala-daily-needs@superapp.com','9812370892','+91','$2y$12$WbLPK8aViVh2v3n3h/uz6.Q5cWemZP/JlPCJ4ateEnHkqJuNvxG8K',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(34,'Jagatpura Spice Court','vendor.jaipur.jagatpura-spice-court@superapp.com','9812372187','+91','$2y$12$gvsdiPABA1Ip5Ip3nTPx8e.htMArUaVLtBihAFkkRfHzUe29iZKK6',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(35,'Sitapura Biryani House','vendor.jaipur.sitapura-biryani-house@superapp.com','9812373243','+91','$2y$12$C.mCLtQqEE.UKQHif3eH3em.HfyC2YH227MeP1PNjlwE4t5vb.mGW',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(36,'South Super Bazaar','vendor.jaipur.south-super-bazaar@superapp.com','9812370034','+91','$2y$12$a3tyPSKc5Ny1GzPziaGo7.Nqxf3R0eDtyUjV/eSOYOdquBjtVGcTK',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:19','2026-09-18 04:12:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(37,'Malviya Fresh Mart','vendor.jaipur.malviya-fresh-mart@superapp.com','9812374512','+91','$2y$12$Xbk33cE9/m1UZBRea7Uw0.rdlRGz4O6j72Z459QYc.IYWDFCOlPqi',NULL,NULL,NULL,NULL,NULL,NULL,'vendor','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(38,'Jaipur Food Partner JAI-CENTRAL #1','partner.jaipur.jai-central.food.1@superapp.com','9730182015','+91','$2y$12$a3PVbHKpg.WJRZncEDHejOb7b0koPKOAnrorhi9Sojp9r/.QkFOC6',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(39,'Jaipur Food Partner JAI-CENTRAL #2','partner.jaipur.jai-central.food.2@superapp.com','9730270599','+91','$2y$12$OrUgZX0MyinYCjTp41mpg.Zs2c2R2vbcAVfgKkpnDaG5gOtMs5cFu',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(40,'Jaipur Food Partner JAI-CENTRAL #3','partner.jaipur.jai-central.food.3@superapp.com','9730140206','+91','$2y$12$uiBp9e7aDYCMZEH0uHIn4eNlT3l4JxG.fMhrQOfDsf6bVYnkd2soK',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:20','2026-09-18 04:12:20',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(41,'Jaipur Grocery Partner JAI-CENTRAL #1','partner.jaipur.jai-central.grocery.1@superapp.com','9730977526','+91','$2y$12$fGR0QNzmpg87ydV02DTab..0YSRs6zVTN/68MLYUpBGpeCJwcUyny',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:21','2026-09-18 04:12:21',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:21','2026-09-18 04:12:21'),(42,'Jaipur Grocery Partner JAI-CENTRAL #2','partner.jaipur.jai-central.grocery.2@superapp.com','9730921470','+91','$2y$12$PLq8.O4VkHEzeY9o.nMfr.zZZMOyrUBoSJcHPon1DcKV5Ha5O3BhG',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:21','2026-09-18 04:12:21',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:21','2026-09-18 04:12:21'),(43,'Jaipur Driver JAI-CENTRAL #1','driver.jaipur.jai-central.ride.1@superapp.com','9740138542','+91','$2y$12$1n1DQQW.ZDbHKVAiq7umZujy3z0oxS6fzykb2tT5YpzpIgIbvcSPm',NULL,NULL,NULL,NULL,NULL,NULL,'driver','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:21','2026-09-18 04:12:21',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:21','2026-09-18 04:12:21'),(44,'Jaipur Driver JAI-CENTRAL #2','driver.jaipur.jai-central.ride.2@superapp.com','9740660097','+91','$2y$12$bZ.25iQwNqR1BLNQeTgcOeom5agZKIL/pklIHmyCxbSYw5OcEE59y',NULL,NULL,NULL,NULL,NULL,NULL,'driver','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:21','2026-09-18 04:12:21',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:21','2026-09-18 04:12:21'),(45,'Jaipur Driver JAI-CENTRAL #3','driver.jaipur.jai-central.ride.3@superapp.com','9740130883','+91','$2y$12$Y.6/6sac30XxP7v6BDhPjeKAUi477mL..A4/Af9u4eaKZeYMoi3j6',NULL,NULL,NULL,NULL,NULL,NULL,'driver','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:21','2026-09-18 04:12:21',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:21','2026-09-18 04:12:21'),(46,'Jaipur Food Partner JAI-NORTH #1','partner.jaipur.jai-north.food.1@superapp.com','9730235489','+91','$2y$12$9LKHk547bzGlDUN8ghLruun7H4/SJSUTrZNumtkjxRqNKSYARiPlC',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:22','2026-09-18 04:12:22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:22','2026-09-18 04:12:22'),(47,'Jaipur Food Partner JAI-NORTH #2','partner.jaipur.jai-north.food.2@superapp.com','9730618667','+91','$2y$12$y6r4I9U204CNW.FM76.VDukiNEI4pGmdFNzrytYrA4.S6eJiebctW',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:22','2026-09-18 04:12:22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:22','2026-09-18 04:12:22'),(48,'Jaipur Food Partner JAI-NORTH #3','partner.jaipur.jai-north.food.3@superapp.com','9730827590','+91','$2y$12$kG8uMveJAsnP1gatAtXU9u0byQK70na.yp5HMx7x47nHGig8VG.12',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:22','2026-09-18 04:12:22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:22','2026-09-18 04:12:22'),(49,'Jaipur Grocery Partner JAI-NORTH #1','partner.jaipur.jai-north.grocery.1@superapp.com','9730801390','+91','$2y$12$KveDlz7Ecb0SXf6XPEY2hu2IKToS4IqzxkHDQNe6dwmZuqp/pLJ6G',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:22','2026-09-18 04:12:22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:22','2026-09-18 04:12:22'),(50,'Jaipur Grocery Partner JAI-NORTH #2','partner.jaipur.jai-north.grocery.2@superapp.com','9730366914','+91','$2y$12$BDDxNrgSI9Ro2b147Az.9uZFge2QEzQbYd.SG6rdbljja.VIKYG6e',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:22','2026-09-18 04:12:22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:22','2026-09-18 04:12:22'),(51,'Jaipur Driver JAI-NORTH #1','driver.jaipur.jai-north.ride.1@superapp.com','9740096438','+91','$2y$12$mmIVC/lN1yTNQByObi.4c.Jx/JzMH/7uz77fzflEwZatfr65OOyh.',NULL,NULL,NULL,NULL,NULL,NULL,'driver','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:23','2026-09-18 04:12:23',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:23','2026-09-18 04:12:23'),(52,'Jaipur Driver JAI-NORTH #2','driver.jaipur.jai-north.ride.2@superapp.com','9740937745','+91','$2y$12$ysnd9XhwKzia4iWhvNpXI.YyOfZoFemg4Gup95rw3.AGDIzNCSpne',NULL,NULL,NULL,NULL,NULL,NULL,'driver','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:23','2026-09-18 04:12:23',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:23','2026-09-18 04:12:23'),(53,'Jaipur Driver JAI-NORTH #3','driver.jaipur.jai-north.ride.3@superapp.com','9740682830','+91','$2y$12$tjHsNZHCGzMusbQITGqzHOf5HkWEpBW.Rs5oCOMOfgoeQEHIyhQIy',NULL,NULL,NULL,NULL,NULL,NULL,'driver','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:23','2026-09-18 04:12:23',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:23','2026-09-18 04:12:23'),(54,'Jaipur Food Partner JAI-SOUTH #1','partner.jaipur.jai-south.food.1@superapp.com','9730188696','+91','$2y$12$cM5JGmDiJ7wESF0kktxJPOFIARIt6CDl9dBMqJN2SnKHHGDM6UaYa',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:23','2026-09-18 04:12:23',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:23','2026-09-18 04:12:23'),(55,'Jaipur Food Partner JAI-SOUTH #2','partner.jaipur.jai-south.food.2@superapp.com','9730824340','+91','$2y$12$6wkkwrujqOvFxT1oCVKng.TJnVQNIfVUVNriW0v6rxOF5wxL3Qqba',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:23','2026-09-18 04:12:23',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:23','2026-09-18 04:12:23'),(56,'Jaipur Food Partner JAI-SOUTH #3','partner.jaipur.jai-south.food.3@superapp.com','9730258231','+91','$2y$12$TSFXLeS1Z1WJQzZaqw7jieMMjSiI5Nmmt6X1rzNKR7W2ggmYsrjke',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:24','2026-09-18 04:12:24',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:24','2026-09-18 04:12:24'),(57,'Jaipur Grocery Partner JAI-SOUTH #1','partner.jaipur.jai-south.grocery.1@superapp.com','9730108602','+91','$2y$12$RF1xAbR63PSp8RceYcUGw.vXiiYSN84.8c51nfwXinSvkKMjpSjRq',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:24','2026-09-18 04:12:24',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:24','2026-09-18 04:12:24'),(58,'Jaipur Grocery Partner JAI-SOUTH #2','partner.jaipur.jai-south.grocery.2@superapp.com','9730098842','+91','$2y$12$fL1WK64uy/6BwVuW6cnjW.WPle.RZY4fS5hvNYMYc9HWKUjRPP8/i',NULL,NULL,NULL,NULL,NULL,NULL,'delivery_partner','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:24','2026-09-18 04:12:24',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:24','2026-09-18 04:12:24'),(59,'Jaipur Driver JAI-SOUTH #1','driver.jaipur.jai-south.ride.1@superapp.com','9740216207','+91','$2y$12$QDu8XDVi38ZpCDyR4e55IOgKbpHnU5QCkJwLR9bwSpqaIcOIuepDK',NULL,NULL,NULL,NULL,NULL,NULL,'driver','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:24','2026-09-18 04:12:24',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:24','2026-09-18 04:12:24'),(60,'Jaipur Driver JAI-SOUTH #2','driver.jaipur.jai-south.ride.2@superapp.com','9740228037','+91','$2y$12$cSj0yl8cbObBdXQ7DuPpsO/knCdMMxzzCraLmtavQ9yl7UfEY0Q8K',NULL,NULL,NULL,NULL,NULL,NULL,'driver','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:24','2026-09-18 04:12:24',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:24','2026-09-18 04:12:24'),(61,'Jaipur Driver JAI-SOUTH #3','driver.jaipur.jai-south.ride.3@superapp.com','9740186056','+91','$2y$12$.tk8bUNiUUtAzXVedYPOTuTYwl6zqK4Q88yMWRJ2jKXFxnZyTxHKe',NULL,NULL,NULL,NULL,NULL,NULL,'driver','en','INR','Asia/Kolkata',1,1,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25'),(63,'foodpartner1','foodpartner1@gmail.com','8756456354','+91','$2y$12$y768Fx2PeS/5Z4ghkNZsgO5Skx.MWtV482N1cjjjkX.N/EfWVLtPG',NULL,NULL,NULL,NULL,'YZD2KW',NULL,'delivery_partner','en','INR','Asia/Kolkata',1,0,NULL,NULL,'2026-09-28 00:40:11','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 05:20:03','2026-09-28 00:40:11'),(64,'guarav singhal','gsinghal6011@gmail.com','6377942673','+91','$2y$12$jDEv6dEYgi8Tbg52RtbzquLh1N9WtwcvC56DQLO1khrixQThr2olS','109535226846557155637',NULL,'2026-09-25 07:25:49',NULL,'WOUOFD',NULL,'customer','en','INR','Asia/Kolkata',1,1,NULL,'2026-09-25 07:25:49','2026-09-26 01:53:00','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,'OC7UMbPwgaqf8sqcySXStRvH5CkoDq9EBVAhe1V6fNQ9QABgYCodmYnkC06f',NULL,'2026-09-18 06:33:25','2026-09-26 01:53:00'),(65,'grocerypartner1','grocerypartner1@gmail.com','5637478465','+91','$2y$12$fh1x9JoqX1gXkfJOF87fD.8oaVNpe4gHRLbeToBinxNOPK7HV.Jja',NULL,NULL,NULL,NULL,'B4QVQF',NULL,'delivery_partner','en','INR','Asia/Kolkata',1,0,NULL,NULL,'2026-09-28 01:02:55','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 06:49:18','2026-09-28 01:02:55'),(66,'driver1','driver1@gmail.com','6575768596','+91','$2y$12$BuqTEpr0YqRo8a7iUekoYeDwk4zMLzhx4BUDLBd.A92Slq450LQSu',NULL,NULL,NULL,NULL,'D3BBAV',NULL,'driver','en','INR','Asia/Kolkata',1,0,NULL,NULL,'2026-09-26 01:23:55','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-18 07:01:39','2026-09-26 01:23:55'),(67,'driver2','driver2@gmail.com','6565657686','+91','$2y$12$k0SNaa2dQhaejle2frDbWOfbO83KHm7hUBatx344WdT8AvfUG5dKu',NULL,NULL,NULL,NULL,'XILV3W',NULL,'driver','en','INR','Asia/Kolkata',1,0,NULL,NULL,'2026-09-26 01:23:46','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-21 00:58:38','2026-09-26 01:23:46'),(68,'food delivery vendor2','fooddeliveryvendor2@gmail.com','7676767676','+91','$2y$12$NjI/0pjmr3iWoJMp9W6L5e6seb/DO17HOXNwsF8ecpIkm7izhNwpW',NULL,NULL,NULL,NULL,'VBX4QV',NULL,'vendor','en','INR','Asia/Kolkata',1,0,NULL,NULL,'2026-09-21 03:26:44','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-21 03:25:49','2026-09-21 03:26:44'),(70,'food vendor3','foodvendor3@gmail.com','5454536464','+91','$2y$12$6lemd44znvH.nGoTMiCvD.FrHihbZkycyw5lvoHhVz1jpVJVJ8c9K',NULL,NULL,NULL,NULL,'B9SBOX',NULL,'vendor','en','INR','Asia/Kolkata',1,0,NULL,NULL,'2026-09-21 05:08:11','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-21 05:07:45','2026-09-21 05:08:36'),(71,'Fresh Customer','fresh.customer.23559@example.com','9000007788','+91','$2y$12$Z1XdSLNswhdzhLRWXh8EfuXY.ligQHFkB6xVBXsFxyVUUVDeM/JD2',NULL,NULL,NULL,NULL,'5TXPS1',NULL,'customer','en','INR','Asia/Kolkata',1,0,NULL,NULL,'2026-09-25 06:19:19','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,'2026-09-25 06:19:29','2026-09-25 06:18:57','2026-09-25 06:19:29'),(72,'aman tak','aman.tak@gmail.com','9878677678','+91','$2y$12$d4YG9vANXtkpBSHL5jBFgeotM0w7I09yuzHNtEv6fRhEQRpAuD3wW',NULL,NULL,NULL,NULL,'BILWUF',NULL,'customer','en','INR','Asia/Kolkata',1,0,NULL,NULL,'2026-09-25 06:20:36','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-25 06:20:18','2026-09-25 06:20:36'),(73,'Gaurav Singhal','cgauravsinghal@gmail.com',NULL,'+91',NULL,'102726736758193456227','google','2026-09-25 07:26:07','https://lh3.googleusercontent.com/a/ACg8ocJgXIEdp35ThaPDUncQhPOLYGN_IACvsghws9XWwLWzDgsRLTgc=s96-c','NMZC84',NULL,'customer','en','INR','Asia/Kolkata',1,1,NULL,'2026-09-25 07:26:07','2026-09-26 01:29:17','127.0.0.1',NULL,NULL,NULL,NULL,NULL,0.00,0,NULL,NULL,NULL,NULL,'2026-09-25 07:26:07','2026-09-26 01:29:17');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `variation_option_values`
--

DROP TABLE IF EXISTS `variation_option_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `variation_option_values` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `variation_option_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price_adjustment` decimal(10,2) NOT NULL DEFAULT '0.00',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_available` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `variation_option_values_variation_option_id_foreign` (`variation_option_id`),
  CONSTRAINT `variation_option_values_variation_option_id_foreign` FOREIGN KEY (`variation_option_id`) REFERENCES `variation_options` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `variation_option_values`
--

LOCK TABLES `variation_option_values` WRITE;
/*!40000 ALTER TABLE `variation_option_values` DISABLE KEYS */;
INSERT INTO `variation_option_values` VALUES (3,2,'Half',190.00,0,1,1,'2026-09-25 00:50:08','2026-09-25 00:50:08'),(4,2,'Full',299.00,0,1,2,'2026-09-25 00:50:08','2026-09-25 01:04:36'),(8,4,'Kulhad',10.00,0,1,1,'2026-09-25 01:19:28','2026-09-25 01:19:28'),(9,4,'Cup',0.00,0,1,2,'2026-09-25 01:19:28','2026-09-25 01:19:28'),(10,4,'elaichi',10.00,0,1,3,'2026-09-25 01:19:28','2026-09-25 01:19:28'),(11,4,'adrak',10.00,0,1,4,'2026-09-25 01:19:28','2026-09-25 01:19:28'),(12,5,'5 Kg',265.00,0,1,1,'2026-09-25 03:14:01','2026-09-25 03:14:01'),(13,5,'10 Kg',412.00,0,1,2,'2026-09-25 03:14:01','2026-09-25 03:14:01');
/*!40000 ALTER TABLE `variation_option_values` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `variation_options`
--

DROP TABLE IF EXISTS `variation_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `variation_options` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'radio',
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `is_multi_select` tinyint(1) NOT NULL DEFAULT '0',
  `min_select` int unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `max_select` int DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `variation_options_product_id_foreign` (`product_id`),
  CONSTRAINT `variation_options_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `variation_options`
--

LOCK TABLES `variation_options` WRITE;
/*!40000 ALTER TABLE `variation_options` DISABLE KEYS */;
INSERT INTO `variation_options` VALUES (2,8,'Plate','radio',1,0,1,1,1,1,'2026-09-25 00:50:08','2026-09-25 00:50:08'),(4,14,'addons','checkbox',1,1,1,1,3,1,'2026-09-25 01:19:28','2026-09-25 01:27:07'),(5,24,'Kg','radio',1,0,1,1,1,1,'2026-09-25 03:14:01','2026-09-25 03:14:01');
/*!40000 ALTER TABLE `variation_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_documents`
--

DROP TABLE IF EXISTS `vehicle_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vehicle_id` bigint unsigned NOT NULL,
  `type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `vehicle_documents_vehicle_id_foreign` (`vehicle_id`),
  CONSTRAINT `vehicle_documents_vehicle_id_foreign` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_documents`
--

LOCK TABLES `vehicle_documents` WRITE;
/*!40000 ALTER TABLE `vehicle_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `vehicle_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_types`
--

DROP TABLE IF EXISTS `vehicle_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_types` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `capacity` int unsigned NOT NULL DEFAULT '1',
  `ac` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicle_types_code_unique` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_types`
--

LOCK TABLES `vehicle_types` WRITE;
/*!40000 ALTER TABLE `vehicle_types` DISABLE KEYS */;
INSERT INTO `vehicle_types` VALUES (1,'Bike','bike',NULL,'1 passenger',1,0,1,0,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(2,'Auto','auto',NULL,'3 passengers',3,0,1,0,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(3,'Cab Mini','cab_mini',NULL,'4 passengers',4,1,1,0,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(4,'Cab Sedan','cab_sedan',NULL,'4 passengers',4,1,1,0,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(5,'Cab SUV','cab_suv',NULL,'6 passengers',6,1,1,0,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14');
/*!40000 ALTER TABLE `vehicle_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicles`
--

DROP TABLE IF EXISTS `vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `driver_id` bigint unsigned NOT NULL,
  `vehicle_type_id` bigint unsigned NOT NULL,
  `make` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `year` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `registration_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `documents` json DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicles_registration_number_unique` (`registration_number`),
  KEY `vehicles_driver_id_foreign` (`driver_id`),
  KEY `vehicles_vehicle_type_id_foreign` (`vehicle_type_id`),
  CONSTRAINT `vehicles_driver_id_foreign` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vehicles_vehicle_type_id_foreign` FOREIGN KEY (`vehicle_type_id`) REFERENCES `vehicle_types` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicles`
--

LOCK TABLES `vehicles` WRITE;
/*!40000 ALTER TABLE `vehicles` DISABLE KEYS */;
/*!40000 ALTER TABLE `vehicles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_categories`
--

DROP TABLE IF EXISTS `vendor_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` bigint unsigned NOT NULL,
  `store_id` bigint unsigned DEFAULT NULL,
  `restaurant_id` bigint unsigned DEFAULT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vendor_categories_vendor_id_slug_unique` (`vendor_id`,`slug`),
  KEY `vendor_categories_parent_id_foreign` (`parent_id`),
  KEY `vendor_categories_vendor_id_is_active_index` (`vendor_id`,`is_active`),
  KEY `vendor_categories_vendor_id_parent_id_index` (`vendor_id`,`parent_id`),
  KEY `vendor_categories_store_id_is_active_index` (`store_id`,`is_active`),
  KEY `vendor_categories_restaurant_id_is_active_index` (`restaurant_id`,`is_active`),
  CONSTRAINT `vendor_categories_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `vendor_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vendor_categories_restaurant_id_foreign` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vendor_categories_store_id_foreign` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vendor_categories_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_categories`
--

LOCK TABLES `vendor_categories` WRITE;
/*!40000 ALTER TABLE `vendor_categories` DISABLE KEYS */;
INSERT INTO `vendor_categories` VALUES (1,6,NULL,1,NULL,'Starters','starters',NULL,'https://picsum.photos/seed/vc-6-Starters/400/300',NULL,1,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(2,6,NULL,1,1,'Paneer Starters','paneer-starters',NULL,'https://picsum.photos/seed/vc-6-Paneer%20Starters/400/300',NULL,3,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(3,6,NULL,1,1,'Chicken Starters','chicken-starters',NULL,'https://picsum.photos/seed/vc-6-Chicken%20Starters/400/300',NULL,4,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(4,6,NULL,1,NULL,'Main Course','main-course',NULL,'https://picsum.photos/seed/vc-6-Main%20Course/400/300',NULL,5,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(5,6,NULL,1,4,'Veg Curries','veg-curries',NULL,'https://picsum.photos/seed/vc-6-Veg%20Curries/400/300',NULL,7,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(6,6,NULL,1,4,'Rice & Dal','rice-dal',NULL,'https://picsum.photos/seed/vc-6-Rice%20%26%20Dal/400/300',NULL,8,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(7,6,NULL,1,NULL,'Biryani','biryani',NULL,'https://picsum.photos/seed/vc-6-Biryani/400/300',NULL,9,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(8,6,NULL,1,7,'Veg Biryani','veg-biryani',NULL,'https://picsum.photos/seed/vc-6-Veg%20Biryani/400/300',NULL,11,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(9,6,NULL,1,7,'Chicken Biryani','chicken-biryani',NULL,'https://picsum.photos/seed/vc-6-Chicken%20Biryani/400/300',NULL,12,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(10,6,NULL,1,NULL,'Breads','breads',NULL,'https://picsum.photos/seed/vc-6-Breads/400/300',NULL,13,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(11,6,NULL,1,NULL,'Desserts','desserts',NULL,'https://picsum.photos/seed/vc-6-Desserts/400/300',NULL,14,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(12,6,NULL,1,NULL,'Beverages','beverages',NULL,'https://picsum.photos/seed/vc-6-Beverages/400/300',NULL,15,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(13,6,NULL,1,12,'Hot Beverages','hot-beverages',NULL,'https://picsum.photos/seed/vc-6-Hot%20Beverages/400/300',NULL,17,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(14,6,NULL,1,12,'Cold Beverages','cold-beverages',NULL,'https://picsum.photos/seed/vc-6-Cold%20Beverages/400/300',NULL,18,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(15,7,1,NULL,NULL,'Fresh Fruits','fresh-fruits',NULL,'https://picsum.photos/seed/vc-7-Fresh%20Fruits/400/300',NULL,1,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(16,7,1,NULL,NULL,'Vegetables','vegetables',NULL,'https://picsum.photos/seed/vc-7-Vegetables/400/300',NULL,2,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(17,7,1,NULL,NULL,'Dairy','dairy',NULL,'https://picsum.photos/seed/vc-7-Dairy/400/300',NULL,3,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(18,7,1,NULL,17,'Milk','milk',NULL,'https://picsum.photos/seed/vc-7-Milk/400/300',NULL,5,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(19,7,1,NULL,17,'Cheese & Butter','cheese-butter',NULL,'https://picsum.photos/seed/vc-7-Cheese%20%26%20Butter/400/300',NULL,6,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(20,7,1,NULL,17,'Yogurt & Curd','yogurt-curd',NULL,'https://picsum.photos/seed/vc-7-Yogurt%20%26%20Curd/400/300',NULL,7,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(21,7,1,NULL,NULL,'Bakery','bakery',NULL,'https://picsum.photos/seed/vc-7-Bakery/400/300',NULL,8,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(22,7,1,NULL,21,'Breads','breads',NULL,'https://picsum.photos/seed/vc-7-Breads/400/300',NULL,10,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(23,7,1,NULL,21,'Buns & Rolls','buns-rolls',NULL,'https://picsum.photos/seed/vc-7-Buns%20%26%20Rolls/400/300',NULL,11,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(24,7,1,NULL,NULL,'Grains & Staples','grains-staples',NULL,'https://picsum.photos/seed/vc-7-Grains%20%26%20Staples/400/300',NULL,12,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(25,7,1,NULL,NULL,'Snacks','snacks',NULL,'https://picsum.photos/seed/vc-7-Snacks/400/300',NULL,13,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(26,7,1,NULL,NULL,'Beverages','beverages',NULL,'https://picsum.photos/seed/vc-7-Beverages/400/300',NULL,14,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(27,7,1,NULL,NULL,'Home Care','home-care',NULL,'https://picsum.photos/seed/vc-7-Home%20Care/400/300',NULL,15,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL),(28,7,1,NULL,NULL,'Personal Care','personal-care',NULL,'https://picsum.photos/seed/vc-7-Personal%20Care/400/300',NULL,16,1,NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25',NULL);
/*!40000 ALTER TABLE `vendor_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_documents`
--

DROP TABLE IF EXISTS `vendor_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` bigint unsigned NOT NULL,
  `type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `reviewed_by` bigint unsigned DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `vendor_documents_vendor_id_foreign` (`vendor_id`),
  KEY `vendor_documents_reviewed_by_foreign` (`reviewed_by`),
  CONSTRAINT `vendor_documents_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vendor_documents_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_documents`
--

LOCK TABLES `vendor_documents` WRITE;
/*!40000 ALTER TABLE `vendor_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `business_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gst_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pan_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fssai_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_ifsc` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cover_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `rejection_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `commission_rate` decimal(5,2) NOT NULL DEFAULT '15.00',
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `zone_id` bigint unsigned DEFAULT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `documents` json DEFAULT NULL,
  `kyc_data` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vendors_user_id_unique` (`user_id`),
  KEY `vendors_vendor_type_status_index` (`vendor_type`,`status`),
  KEY `vendors_latitude_longitude_index` (`latitude`,`longitude`),
  KEY `vendors_zone_id_foreign` (`zone_id`),
  CONSTRAINT `vendors_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vendors_zone_id_foreign` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (6,15,'Spice Villa Restaurant Pvt Ltd','restaurant','Rajesh Kumar','restaurant@superapp.com','9812345678','07ABCDE1234F1Z5','ABCDE1234F',NULL,'spice villa','00005467584','SBIN0004645','SBI','http://localhost:8000/storage/vendor-images/dEPilYbif0vZJJSLRvDHTOqbWojKGC06t0z25TQC.jpg','http://localhost:8000/storage/vendor-images/Tw6IQi83TtVdFcWrLKr5bjMRaPUWAFZHlmC9X9B8.jpg','approved',NULL,'2026-09-18 04:12:15',15.00,26.8458270,75.8046652,3,'Jaipur Municipal Corporation, Sanganer Tehsil, Jaipur, Rajasthan, 302018, India',NULL,NULL,1,'2026-09-18 04:12:15','2026-09-25 04:23:11'),(7,16,'FreshMart Grocery Stores','grocery','Priya Sharma',NULL,'9823456789','08XYZDE5678G1Z6','XYZDE5678G',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:15',10.00,26.8457243,75.8047489,3,'Jaipur, Rajasthan, India',NULL,NULL,1,'2026-09-18 04:12:15','2026-09-28 01:07:54'),(8,20,'Rajasthani Rasoi Jaipur','restaurant','Mahendra Singh','vendor.jaipur@superapp.com','9812367000','08JAIPUR1234F1Z8','JAIPUR1234F',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:16',15.00,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-09-18 04:12:16','2026-09-18 04:12:16'),(9,26,'Handi Restaurant','restaurant','Rakesh Sharma','vendor.jaipur.handi-restaurant@superapp.com','9812378261','084008C745AF1Za','4008C745AF',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:17',15.00,26.9124000,75.7873000,1,'C-Scheme, Ashok Marg, Jaipur',NULL,NULL,1,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(10,27,'Laxmi Mishthan Bhandar','restaurant','Anil Gupta','vendor.jaipur.laxmi-mishthan-bhandar@superapp.com','9812372419','08213A5DB7101Z9','213A5DB710',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:17',15.00,26.9180000,75.8260000,1,'Johari Bazaar, Jaipur',NULL,NULL,1,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(11,28,'Jaipur Grocers','grocery','Sunita Agarwal','vendor.jaipur.jaipur-grocers@superapp.com','9812374294','086CA03A6EAD1Z5','6CA03A6EAD',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:18',10.00,26.9080000,75.8000000,1,'Ashok Nagar, Jaipur',NULL,NULL,1,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(12,29,'Pink City Supermart','grocery','Vikram Singh','vendor.jaipur.pink-city-supermart@superapp.com','9812373184','08ABD1878C961Z3','ABD1878C96',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:18',10.00,26.9150000,75.7800000,1,'MI Road, Jaipur',NULL,NULL,1,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(13,30,'Vidhyadhar Dhaba','restaurant','Mohan Lal','vendor.jaipur.vidhyadhar-dhaba@superapp.com','9812374327','08D46E2522121Za','D46E252212',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:18',15.00,26.9600000,75.7900000,2,'Vidhyadhar Nagar, Jaipur',NULL,NULL,1,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(14,31,'Jhotwara Kitchen','restaurant','Deepak Meena','vendor.jaipur.jhotwara-kitchen@superapp.com','9812374631','08F2C76D29BA1Z3','F2C76D29BA',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:18',15.00,26.9450000,75.7450000,2,'Jhotwara, Jaipur',NULL,NULL,1,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(15,32,'North Mart','grocery','Kavita Jain','vendor.jaipur.north-mart@superapp.com','9812370181','0884BA1D6DCF1Z9','84BA1D6DCF',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:19',10.00,26.9550000,75.7700000,2,'Mansarovar, Jaipur',NULL,NULL,1,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(16,33,'Sodala Daily Needs','grocery','Rajesh Kumar','vendor.jaipur.sodala-daily-needs@superapp.com','9812370892','088875D366CD1Zc','8875D366CD',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:19',10.00,26.9350000,75.7600000,2,'Sodala, Jaipur',NULL,NULL,1,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(17,34,'Jagatpura Spice Court','restaurant','Pankaj Yadav','vendor.jaipur.jagatpura-spice-court@superapp.com','9812372187','08A02014F3171Z6','A02014F317',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:19',15.00,26.8457000,75.8048000,3,'Jagatpura, Jaipur',NULL,NULL,1,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(18,35,'Sitapura Biryani House','restaurant','Imran Khan','vendor.jaipur.sitapura-biryani-house@superapp.com','9812373243','085CE414335E1Z8','5CE414335E',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:19',15.00,26.8300000,75.7500000,3,'Sitapura, Jaipur',NULL,NULL,1,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(19,36,'South Super Bazaar','grocery','Neha Choudhary','vendor.jaipur.south-super-bazaar@superapp.com','9812370034','08171B53C4041Z5','171B53C404',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:20',10.00,26.8400000,75.7600000,3,'Sitapura, Jaipur',NULL,NULL,1,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(20,37,'Malviya Fresh Mart','grocery','Suresh Saini','vendor.jaipur.malviya-fresh-mart@superapp.com','9812374512','082D2BEE0FA31Z3','2D2BEE0FA3',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'approved',NULL,'2026-09-18 04:12:20',10.00,26.8550000,75.8100000,3,'Malviya Nagar, Jaipur',NULL,NULL,1,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(21,68,'food delivery vendor2','restaurant','food delivery vendor2','fooddeliveryvendor2@gmail.com','7676767676','26ABCDE761F5','NVHFT6565Y','43535364647585','food delivery vendor2','0000765656768944','SBIN000857','SBI',NULL,NULL,'approved',NULL,'2026-09-21 03:26:10',20.00,26.8456854,75.8047638,3,'waplia digital solutions, malviya nagar, jaipur, rajasthan',NULL,NULL,1,'2026-09-21 03:25:49','2026-09-21 03:27:01'),(23,70,'food vendor3','restaurant','food vendor3','foodvendor3@gmail.com','5454536464','26ABCDE65T8','BFHGY5768F','67465674859745','food vendor3','000065768654','SBIN0000556','SBI',NULL,NULL,'approved',NULL,'2026-09-21 05:08:36',20.00,NULL,NULL,NULL,'sujag apartment, mansarovar, jaipur',NULL,NULL,1,'2026-09-21 05:07:45','2026-09-21 05:08:36');
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wallet_transactions`
--

DROP TABLE IF EXISTS `wallet_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallet_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `transaction_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wallet_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `type` enum('EARNING','CREDIT','DEBIT','REFUND','COMMISSION','PAYOUT','SETTLEMENT','BONUS','INCENTIVE','CASH_COLLECTION','ADJUSTMENT','REVERSAL','TOP_UP','PURCHASE','WITHDRAWAL') COLLATE utf8mb4_unicode_ci NOT NULL,
  `service` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `balance_before` decimal(12,2) NOT NULL,
  `balance_after` decimal(12,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `direction` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'completed',
  `reference_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` bigint unsigned DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `meta` json DEFAULT NULL,
  `idempotency_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reversed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `wallet_transactions_transaction_id_unique` (`transaction_id`),
  UNIQUE KEY `wallet_transactions_idempotency_key_unique` (`idempotency_key`),
  KEY `wallet_transactions_wallet_id_created_at_index` (`wallet_id`,`created_at`),
  KEY `wallet_transactions_user_id_type_index` (`user_id`,`type`),
  KEY `wallet_transactions_reference_type_index` (`reference_type`),
  KEY `wallet_transactions_reference_id_index` (`reference_id`),
  KEY `wallet_transactions_service_index` (`service`),
  CONSTRAINT `wallet_transactions_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `wallet_transactions_wallet_id_foreign` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wallet_transactions`
--

LOCK TABLES `wallet_transactions` WRITE;
/*!40000 ALTER TABLE `wallet_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `wallet_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wallets`
--

DROP TABLE IF EXISTS `wallets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `wallet_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `balance` decimal(12,2) NOT NULL DEFAULT '0.00',
  `pending_balance` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_credited` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_debited` decimal(15,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `wallets_user_id_wallet_type_unique` (`user_id`,`wallet_type`),
  CONSTRAINT `wallets_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=85 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wallets`
--

LOCK TABLES `wallets` WRITE;
/*!40000 ALTER TABLE `wallets` DISABLE KEYS */;
INSERT INTO `wallets` VALUES (1,14,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(2,15,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:15','2026-09-28 00:45:32'),(3,16,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:15','2026-09-28 00:20:29'),(4,17,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(5,18,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:15','2026-09-18 04:12:15'),(6,19,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16'),(7,20,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16'),(8,21,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16'),(9,22,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:16','2026-09-18 04:12:16'),(10,23,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(11,24,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(12,25,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(13,26,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(14,27,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:17','2026-09-18 04:12:17'),(15,28,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(16,29,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(17,30,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(18,31,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:18','2026-09-18 04:12:18'),(19,32,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(20,33,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(21,34,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(22,35,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:19','2026-09-18 04:12:19'),(23,36,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(24,37,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(25,38,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(26,39,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(27,40,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:20','2026-09-18 04:12:20'),(28,41,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:21','2026-09-18 04:12:21'),(29,42,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:21','2026-09-18 04:12:21'),(30,43,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:21','2026-09-18 04:12:21'),(31,44,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:21','2026-09-18 04:12:21'),(32,45,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:21','2026-09-18 04:12:21'),(33,46,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:22','2026-09-18 04:12:22'),(34,47,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:22','2026-09-18 04:12:22'),(35,48,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:22','2026-09-18 04:12:22'),(36,49,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:22','2026-09-18 04:12:22'),(37,50,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:22','2026-09-18 04:12:22'),(38,51,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:23','2026-09-18 04:12:23'),(39,52,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:23','2026-09-18 04:12:23'),(40,53,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:23','2026-09-18 04:12:23'),(41,54,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:23','2026-09-18 04:12:23'),(42,55,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:23','2026-09-18 04:12:23'),(43,56,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:24','2026-09-18 04:12:24'),(44,57,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:24','2026-09-18 04:12:24'),(45,58,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:24','2026-09-18 04:12:24'),(46,59,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:24','2026-09-18 04:12:24'),(47,60,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:24','2026-09-18 04:12:24'),(48,61,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:25','2026-09-18 04:12:25'),(49,13,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:28','2026-09-18 04:12:28'),(50,15,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 04:12:44','2026-09-18 04:12:44'),(54,63,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 05:20:03','2026-09-28 00:45:32'),(55,63,'platform',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 05:20:03','2026-09-18 05:20:03'),(56,63,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 05:20:05','2026-09-18 05:20:05'),(57,64,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 06:33:26','2026-09-18 06:33:26'),(58,64,'platform',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 06:33:26','2026-09-18 06:33:26'),(59,16,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 06:47:33','2026-09-18 06:47:33'),(60,65,'delivery_partner',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 06:49:18','2026-09-28 00:20:29'),(61,65,'platform',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 06:49:18','2026-09-18 06:49:18'),(62,65,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 06:49:26','2026-09-18 06:49:26'),(63,17,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 06:54:22','2026-09-18 06:54:22'),(64,66,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 07:01:39','2026-09-26 01:27:35'),(65,66,'platform',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 07:01:39','2026-09-18 07:01:39'),(66,66,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-18 07:01:42','2026-09-18 07:01:42'),(67,67,'driver',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-21 00:58:38','2026-09-25 03:59:28'),(68,67,'platform',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-21 00:58:38','2026-09-21 00:58:38'),(69,67,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-21 00:58:43','2026-09-21 00:58:43'),(70,68,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-21 03:25:49','2026-09-21 03:25:49'),(71,68,'platform',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-21 03:25:49','2026-09-21 03:25:49'),(72,68,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-21 03:26:44','2026-09-21 03:26:44'),(76,70,'vendor',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-21 05:07:45','2026-09-21 05:07:45'),(77,70,'platform',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-21 05:07:45','2026-09-21 05:07:45'),(78,70,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-21 05:07:58','2026-09-21 05:07:58'),(81,72,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-25 06:20:18','2026-09-25 06:20:18'),(82,72,'platform',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-25 06:20:18','2026-09-25 06:20:18'),(83,73,'customer',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-25 07:26:07','2026-09-25 07:26:07'),(84,73,'platform',0.00,0.00,0.00,0.00,'INR','active',NULL,'2026-09-25 07:26:07','2026-09-25 07:26:07');
/*!40000 ALTER TABLE `wallets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `webhook_deliveries`
--

DROP TABLE IF EXISTS `webhook_deliveries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `webhook_deliveries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `webhook_event_id` bigint unsigned DEFAULT NULL,
  `subscription_id` bigint unsigned DEFAULT NULL,
  `url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json DEFAULT NULL,
  `headers` json DEFAULT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `last_error` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `webhook_deliveries_status_created_at_index` (`status`,`created_at`),
  KEY `webhook_deliveries_webhook_event_id_index` (`webhook_event_id`),
  KEY `webhook_deliveries_subscription_id_index` (`subscription_id`),
  KEY `webhook_deliveries_status_index` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `webhook_deliveries`
--

LOCK TABLES `webhook_deliveries` WRITE;
/*!40000 ALTER TABLE `webhook_deliveries` DISABLE KEYS */;
/*!40000 ALTER TABLE `webhook_deliveries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `webhook_events`
--

DROP TABLE IF EXISTS `webhook_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `webhook_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `provider` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `signature` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'received',
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `processed_at` timestamp NULL DEFAULT NULL,
  `error` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `webhook_events_provider_status_index` (`provider`,`status`),
  KEY `webhook_events_created_at_index` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `webhook_events`
--

LOCK TABLES `webhook_events` WRITE;
/*!40000 ALTER TABLE `webhook_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `webhook_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `webhook_subscriptions`
--

DROP TABLE IF EXISTS `webhook_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `webhook_subscriptions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `client_id` bigint unsigned DEFAULT NULL,
  `target_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `events` json NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '1',
  `secret` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `webhook_subscriptions_status_client_id_index` (`status`,`client_id`),
  KEY `webhook_subscriptions_user_id_index` (`user_id`),
  KEY `webhook_subscriptions_client_id_index` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `webhook_subscriptions`
--

LOCK TABLES `webhook_subscriptions` WRITE;
/*!40000 ALTER TABLE `webhook_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `webhook_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `zones`
--

DROP TABLE IF EXISTS `zones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zones` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `country` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN',
  `state` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'delivery',
  `food_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `grocery_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `ride_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `priority` int NOT NULL DEFAULT '0',
  `center_latitude` decimal(10,7) DEFAULT NULL,
  `center_longitude` decimal(10,7) DEFAULT NULL,
  `radius_km` decimal(8,2) DEFAULT NULL,
  `food_partner_search_radius_km` decimal(8,2) DEFAULT NULL,
  `grocery_partner_search_radius_km` decimal(8,2) DEFAULT NULL,
  `ride_driver_search_radius_km` decimal(8,2) DEFAULT NULL,
  `allow_cross_zone_food_delivery` tinyint(1) NOT NULL DEFAULT '0',
  `allow_cross_zone_grocery_delivery` tinyint(1) NOT NULL DEFAULT '0',
  `allow_ride_drop_outside_zone` tinyint(1) NOT NULL DEFAULT '1',
  `polygon` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `zones_code_unique` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `zones`
--

LOCK TABLES `zones` WRITE;
/*!40000 ALTER TABLE `zones` DISABLE KEYS */;
INSERT INTO `zones` VALUES (1,'Jaipur Central Zone','JAI-CENTRAL',NULL,'IN','Rajasthan','Jaipur','multi',1,1,1,30,26.8950000,75.8100000,15.00,NULL,NULL,NULL,0,0,1,'[{\"latitude\": 26.865, \"longitude\": 75.72}, {\"latitude\": 26.865, \"longitude\": 75.9}, {\"latitude\": 26.925, \"longitude\": 75.9}, {\"latitude\": 26.925, \"longitude\": 75.72}]',1,NULL,NULL,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(2,'Jaipur North Zone','JAI-NORTH',NULL,'IN','Rajasthan','Jaipur','multi',1,1,1,20,26.9725000,75.8100000,15.00,NULL,NULL,NULL,0,0,1,'[{\"latitude\": 26.925, \"longitude\": 75.72}, {\"latitude\": 26.925, \"longitude\": 75.9}, {\"latitude\": 27.02, \"longitude\": 75.9}, {\"latitude\": 27.02, \"longitude\": 75.72}]',1,NULL,NULL,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14'),(3,'Jaipur South Zone','JAI-SOUTH',NULL,'IN','Rajasthan','Jaipur','multi',1,1,1,10,26.8225000,75.8100000,15.00,NULL,NULL,NULL,0,0,1,'[{\"latitude\": 26.78, \"longitude\": 75.72}, {\"latitude\": 26.78, \"longitude\": 75.9}, {\"latitude\": 26.865, \"longitude\": 75.9}, {\"latitude\": 26.865, \"longitude\": 75.72}]',1,NULL,NULL,NULL,'2026-09-18 04:12:14','2026-09-18 04:12:14');
/*!40000 ALTER TABLE `zones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'superapp'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-28 12:08:27
