<?php

namespace App\Http\Controllers\API;

use App\Services\AiRecommendationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AiController extends BaseController
{
    public function __construct(private AiRecommendationService $aiService) {}

    public function recommendations(Request $request, $service)
    {
        try {
            $user = $request->user();

            $recommendations = match ($service) {
                'food' => $this->aiService->recommendFood($user),
                'grocery' => $this->aiService->recommendGrocery($user),
                default => [],
            };

            return $this->success($recommendations);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function groceryPredictions(Request $request)
    {
        try {
            $suggestions = $this->aiService->getReplenishmentSuggestions($request->user());

            return $this->success($suggestions);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function monthlySuggestions(Request $request)
    {
        try {
            $suggestions = $this->aiService->getMonthlySuggestions($request->user());

            return $this->success($suggestions);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function assistant(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'message' => 'required|string|max:1000',
            'context' => 'sometimes|in:food,grocery,rides,general',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $user = $request->user();
            $context = $request->context ?? 'general';

            $response = match ($context) {
                'food' => $this->getFoodAssistantResponse($user, $request->message),
                'grocery' => $this->getGroceryAssistantResponse($user, $request->message),
                'rides' => $this->getRideAssistantResponse($user, $request->message),
                default => $this->getGeneralAssistantResponse($user, $request->message),
            };

            return $this->success(['response' => $response]);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    private function getFoodAssistantResponse($user, string $message): string
    {
        $recentOrders = $user->orders()
            ->where('order_type', 'food')
            ->where('status', 'DELIVERED')
            ->with('items.product')
            ->latest()
            ->limit(5)
            ->get();

        if ($recentOrders->isEmpty()) {
            return 'Welcome! Based on your preferences, I recommend trying our featured restaurants. Would you like to see today\'s specials?';
        }

        $frequentItems = $recentOrders->flatMap->items->pluck('product_name')->countBy()->take(3)->keys();

        return "Based on your recent orders, you seem to enjoy: {$frequentItems->implode(', ')}. Would you like to reorder or try something new from these cuisines?";
    }

    private function getGroceryAssistantResponse($user, string $message): string
    {
        $suggestions = $this->aiService->getReplenishmentSuggestions($user);

        if (empty($suggestions)) {
            return 'Your pantry looks well-stocked! Check out our fresh deals on seasonal produce.';
        }

        $items = collect($suggestions)->pluck('product.name')->implode(', ');

        return "You might be running low on: {$items}. Would you like me to add these to your cart?";
    }

    private function getRideAssistantResponse($user, string $message): string
    {
        $savedPlaces = $user->savedPlaces()->get();

        if ($savedPlaces->isEmpty()) {
            return 'Where would you like to go? You can save your favorite places for quick access next time.';
        }

        $places = $savedPlaces->pluck('label')->implode(', ');

        return "Your saved places: {$places}. Where would you like to ride today?";
    }

    private function getGeneralAssistantResponse($user, string $message): string
    {
        return "Hi {$user->name}! I can help you with food delivery, grocery orders, or ride-hailing. What would you like to do today?";
    }
}
