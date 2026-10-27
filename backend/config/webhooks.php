<?php

/*
|--------------------------------------------------------------------------
| Outbound webhook event catalog
|--------------------------------------------------------------------------
|
| Events that partners/merchants may subscribe to. The same catalog drives
| API validation and the admin-facing docs.
|
*/

return [
    'events' => [
        'order.created' => 'A new order was placed.',
        'order.updated' => 'Order state changed (status, payment).',
        'order.cancelled' => 'An order was cancelled.',
        'order.picked_up' => 'The order was picked up.',
        'order.out_for_delivery' => 'The order is out for delivery.',
        'order.arrived' => 'The delivery partner arrived at the delivery location.',
        'order.delivered' => 'The order was delivered.',
        'payment.captured' => 'Payment was captured successfully.',
        'payment.failed' => 'A payment attempt failed.',
        'payment.refunded' => 'A refund was processed.',
        'delivery.assigned' => 'A delivery partner was assigned.',
        'delivery.started' => 'Delivery was picked up.',
        'delivery.completed' => 'Delivery was completed.',
        'delivery.failed' => 'Delivery failed.',
        'ride.requested' => 'A ride was requested.',
        'ride.completed' => 'A ride completed.',
        'wallet.credited' => 'Wallet credit was applied.',
        'wallet.debited' => 'Wallet debit was applied.',
        'ping' => 'Test ping event (subscription health check).',
    ],
];
